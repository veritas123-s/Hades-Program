import { ReleaseHub } from "./releases.mjs";
import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { emailOTP, bearer } from "better-auth/plugins";
import { getMigrations } from "better-auth/db/migration";
import { validateCloudDocument } from "../src/cloud-data.mjs";

export async function createBackend({
  database,
  baseURL,
  secret,
  sendEmail,
  testMode = false,
  catalogFile,
  sendUpdateEmail,
}) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("Server secret must contain at least 32 characters");
  const url = new URL(baseURL);
  if (url.protocol !== "https:" && !(testMode && url.hostname === "localhost"))
    throw Error("A public HTTPS origin is required");
  const db = new DatabaseSync(database);
  const delivery = new AsyncLocalStorage();
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
  );
  const auth = betterAuth({
    appName: "Medstack",
    baseURL,
    secret,
    database: db,
    telemetry: { enabled: false },
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: { autoSignInAfterVerification: true },
    session: {
      expiresIn: 30 * 86400,
      updateAge: 86400,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: !testMode, storage: "database", window: 60, max: 30 },
    advanced: {
      ipAddress: {
        ipAddressHeaders: [
          "x-medstack-client-ip",
          Buffer.from("eC1oYWRlcy1jbGllbnQtaXA=", "base64").toString(),
        ],
      },
    },
    plugins: [
      bearer({ requireSignature: true }),
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        storeOTP: "hashed",
        expiresIn: 600,
        allowedAttempts: 3,
        disableSignUp: true,
        sendVerificationOTP: async (message) => {
          try {
            await sendEmail(message);
          } catch {
            const request = delivery.getStore();
            if (request) request.failed = true;
            throw Error("Verification delivery unavailable");
          }
        },
      }),
    ],
  });
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  db.exec(
    "CREATE TABLE IF NOT EXISTS medstack_snapshots (uid TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS medstack_history (uid TEXT NOT NULL, version INTEGER NOT NULL, document TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(uid,version));",
  );
  migrateSnapshotTables(db);
  const read = db.prepare(
    "SELECT version, document, updated_at FROM medstack_snapshots WHERE uid=?",
  );
  const write = db.prepare(
    "INSERT INTO medstack_snapshots(uid,version,document,updated_at) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET version=excluded.version,document=excluded.document,updated_at=excluded.updated_at",
  );
  const history = db.prepare(
    "INSERT OR IGNORE INTO medstack_history(uid,version,document,created_at) VALUES(?,?,?,?)",
  );
  const prune = db.prepare(
    "DELETE FROM medstack_history WHERE uid=? AND version NOT IN (SELECT version FROM medstack_history WHERE uid=? ORDER BY version DESC LIMIT 10)",
  );
  const releases = new ReleaseHub({
    db,
    baseURL,
    catalogFile,
    sendUpdateEmail,
  });
  const routes = new Map([
    ["/sign-up/email", "POST"],
    ["/sign-in/email", "POST"],
    ["/get-session", "GET"],
    ["/sign-out", "POST"],
    ["/update-user", "POST"],
    ["/email-otp/verify-email", "POST"],
    ["/email-otp/send-verification-otp", "POST"],
    ["/email-otp/request-password-reset", "POST"],
    ["/email-otp/reset-password", "POST"],
  ]);
  const securityHeaders = {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
  const reply = (data, status = 200) =>
    Response.json(data, {
      status,
      headers: securityHeaders,
    });
  async function handle(request) {
    try {
      const u = new URL(request.url);
      if (u.pathname === "/health" && request.method === "GET")
        return reply({ ok: true, version: "5.1.0" });
      if (u.pathname === "/api/releases/latest" && request.method === "GET")
        return reply({ release: releases.release });
      if (u.pathname === "/updates/unsubscribe") {
        const token = u.searchParams.get("token");
        if (!/^[a-f0-9]{64}$/.test(token || ""))
          return reply({ error: "INVALID_TOKEN" }, 400);
        if (request.method === "GET")
          return new Response(
            '<!doctype html><html lang="zh"><meta charset="utf-8"><title>医栈通 · 退订</title><body><h1>取消版本更新邮件</h1><form method="post"><button>确认退订</button></form><p>个人数据与账号保持不变。</p></body></html>',
            {
              headers: {
                ...securityHeaders,
                "Content-Type": "text/html; charset=utf-8",
                "Content-Security-Policy":
                  "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
              },
            },
          );
        if (request.method === "POST")
          return releases.unsubscribe(token)
            ? reply({ unsubscribed: true })
            : reply({ error: "INVALID_TOKEN" }, 400);
        return reply({ error: "NOT_FOUND" }, 404);
      }
      const requestOrigin = request.headers.get("origin");
      if (!requestOrigin) return reply({ code: "MISSING_OR_NULL_ORIGIN" }, 403);
      if (requestOrigin !== url.origin)
        return reply({ code: "INVALID_ORIGIN" }, 403);
      if (u.pathname.startsWith("/api/auth/")) {
        const route = u.pathname.slice("/api/auth".length);
        if (routes.get(route) !== request.method)
          return reply({ error: "NOT_FOUND" }, 404);
        return delivery.run({ failed: false }, async () => {
          const response = await auth.handler(request);
          // The authentication library deliberately catches mail callback errors.
          // Do not report a successful delivery when SMTP failed for this request.
          return delivery.getStore().failed
            ? reply({ error: "DELIVERY_UNAVAILABLE" }, 503)
            : response;
        });
      }
      if (
        u.pathname === "/api/releases/preferences" &&
        ["GET", "POST"].includes(request.method)
      ) {
        const identity = await auth.api.getSession({
          headers: request.headers,
        });
        if (!identity?.user?.id || !identity.user.emailVerified)
          return reply({ error: "UNAUTHENTICATED" }, 401);
        return reply(
          request.method === "GET"
            ? releases.preferences(identity.user.id)
            : releases.setPreferences(identity.user.id, await request.json()),
        );
      }
      if (u.pathname !== "/api/sync" || request.method !== "POST")
        return reply({ error: "NOT_FOUND" }, 404);
      const identity = await auth.api.getSession({ headers: request.headers });
      if (!identity?.user?.id || !identity.user.emailVerified)
        return reply({ error: "UNAUTHENTICATED" }, 401);
      const p = await request.json();
      if (
        !p ||
        !["pull", "push"].includes(p.action) ||
        Object.keys(p).some(
          (k) => !["action", "version", "document"].includes(k),
        )
      )
        return reply({ error: "INVALID_REQUEST" }, 400);
      const uid = identity.user.id;
      if (p.action === "pull") {
        const row = read.get(uid);
        return reply({
          version: row?.version || 0,
          document: row ? JSON.parse(row.document) : null,
        });
      }
      if (!Number.isSafeInteger(p.version) || p.version < 0)
        return reply({ error: "INVALID_VERSION" }, 400);
      const document = JSON.stringify(validateCloudDocument(p.document));
      db.exec("BEGIN IMMEDIATE");
      try {
        const row = read.get(uid),
          version = row?.version || 0;
        if (p.version !== version) {
          db.exec("ROLLBACK");
          return reply({ conflict: true, version });
        }
        if (!testMode && row && Date.now() - row.updated_at < 3000) {
          db.exec("ROLLBACK");
          return reply({ error: "RATE_LIMITED" }, 429);
        }
        if (row) {
          history.run(uid, row.version, row.document, Date.now());
          prune.run(uid, uid);
        }
        write.run(uid, version + 1, document, Date.now());
        db.exec("COMMIT");
        return reply({ version: version + 1 });
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    } catch {
      return reply({ error: "REQUEST_FAILED" }, 400);
    }
  }
  return { handle, auth, db, releases, close: () => db.close() };
}
import { migrateSnapshotTables } from "./storage.mjs";
