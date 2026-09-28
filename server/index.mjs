import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { createBackend } from "./backend.mjs";
const directory = path.resolve(
  process.env.HADES_SERVER_DATA ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "data"),
);
fs.mkdirSync(directory, { recursive: true });
const config = JSON.parse(
  fs.readFileSync(path.join(directory, "config.json"), "utf8"),
);
if (
  !config.smtp?.host ||
  !config.smtp?.user ||
  !config.smtp?.password ||
  !config.smtp?.from
)
  throw Error("Configure a verification email sender before starting");
const mail = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port || 465,
  secure: config.smtp.port !== 587,
  requireTLS: true,
  auth: { user: config.smtp.user, pass: config.smtp.password },
  logger: false,
  debug: false,
  connectionTimeout: 12000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});
// Check connectivity under the actual service identity; never send a test email here.
mail
  .verify()
  .then(() =>
    console.log(JSON.stringify({ event: "smtp_connection", ok: true })),
  )
  .catch(() =>
    console.log(JSON.stringify({ event: "smtp_connection", ok: false })),
  );
const backend = await createBackend({
  database: path.join(directory, "hades.sqlite"),
  baseURL: config.baseURL,
  secret: config.secret,
  sendEmail: async ({ email, otp, type }) => {
    const started = Date.now();
    try {
      await mail.sendMail({
        from: config.smtp.from,
        to: email,
        subject:
          type === "forget-password"
            ? "Hades 密码重置验证码"
            : "Hades 邮箱验证码",
        text: `你的 Hades 验证码是 ${otp}，10分钟内有效。如非本人操作，请忽略此邮件。`,
      });
      console.log(
        JSON.stringify({
          event: "verification_delivery",
          ok: true,
          ms: Date.now() - started,
        }),
      );
    } catch {
      console.log(
        JSON.stringify({
          event: "verification_delivery",
          ok: false,
          ms: Date.now() - started,
        }),
      );
      throw Error("Verification delivery unavailable");
    }
  },
});
const counts = new Map();
const server = http.createServer(async (req, res) => {
  const started = Date.now();
  const route = String(req.url || "").split("?")[0];
  if (
    [
      "/api/auth/sign-up/email",
      "/api/auth/sign-in/email",
      "/api/auth/email-otp/send-verification-otp",
      "/api/auth/email-otp/verify-email",
    ].includes(route)
  ) {
    res.once("finish", () =>
      console.log(
        JSON.stringify({
          event: "auth_response",
          route,
          status: res.statusCode,
          ms: Date.now() - started,
        }),
      ),
    );
  }
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const client = String(
        req.headers["x-hades-client-ip"] || req.socket.remoteAddress,
      ).slice(0, 100),
      now = Date.now();
    if (counts.size > 10000)
      for (const [key, value] of counts)
        if (now - value.start > 60000) counts.delete(key);
    const count = counts.get(client);
    if (!count || now - count.start > 60000)
      counts.set(client, { start: now, n: 1 });
    else if (++count.n > 100) {
      res.writeHead(429, headers);
      res.end('{"error":"RATE_LIMITED"}');
      return;
    }
    const limit = req.url?.startsWith("/api/sync") ? 850 * 1024 : 16 * 1024;
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) {
        res.writeHead(413, headers);
        res.end('{"error":"TOO_LARGE"}');
        return;
      }
      chunks.push(chunk);
    }
    const request = new Request(new URL(req.url, config.baseURL), {
      method: req.method,
      headers: new Headers(
        Object.entries(req.headers).filter(
          ([k, v]) =>
            typeof v === "string" &&
            !["host", "connection", "content-length"].includes(k),
        ),
      ),
      ...(["GET", "HEAD"].includes(req.method)
        ? {}
        : { body: Buffer.concat(chunks) }),
    });
    const response = await backend.handle(request);
    res.writeHead(response.status, {
      ...Object.fromEntries(response.headers),
      ...headers,
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, headers);
    res.end('{"error":"SERVER_ERROR"}');
  }
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.maxHeadersCount = 40;
server.listen(config.port || 4318, "127.0.0.1", () =>
  console.log("Hades account service listening on loopback."),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      backend.close();
      process.exit(0);
    }),
  );
