import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBackend } from "../backend.mjs";
import { releaseEmail } from "../releases.mjs";
test("更新邮件必须订阅、验证邮箱；用户隔离、取消待发、退订与重启去重", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "medstack-release-server-"),
  );
  const otps = [],
    outbox = [];
  const options = {
    database: path.join(directory, "test.sqlite"),
    baseURL: "http://localhost:4318",
    secret: "synthetic-release-secret-0000000000000000000",
    testMode: true,
    sendEmail: async (x) => otps.push(x),
    sendUpdateEmail: async (x) => outbox.push(x),
  };
  let b = await createBackend(options);
  const req = async (route, body, token, origin = true) => {
    const r = await b.handle(
      new Request(options.baseURL + route, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(origin ? { Origin: options.baseURL } : {}),
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return { status: r.status, data: await r.json() };
  };
  const user = async (email) => {
    await req("/api/auth/sign-up/email", {
      email,
      password: "Synthetic123!Test",
      name: "Synthetic",
    });
    const r = await b.handle(
      new Request(options.baseURL + "/api/auth/email-otp/verify-email", {
        method: "POST",
        headers: {
          Origin: options.baseURL,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp: otps.at(-1).otp }),
      }),
    );
    assert.equal(r.status, 200);
    return r.headers.get("set-auth-token");
  };
  try {
    const a = await user("a@synthetic.invalid"),
      c = await user("c@synthetic.invalid");
    assert.equal((await req("/api/releases/preferences")).status, 401);
    assert.equal(
      (await req("/api/releases/preferences", undefined, a)).data.emailUpdates,
      false,
    );
    assert.equal(
      (
        await req(
          "/api/releases/preferences",
          { emailUpdates: true, uid: "spoof" },
          a,
        )
      ).status,
      400,
    );
    b.releases.clock = () => 1000;
    await req("/api/releases/preferences", { emailUpdates: true }, a);
    await req("/api/releases/preferences", { emailUpdates: true }, c);
    const release = {
      schema: 1,
      version: "5.1.0",
      publishedAt: "2026-01-01T00:00:00Z",
      title: "医栈通新版",
      notes: ["更新通知"],
      downloads: {
        windows: {
          url: "https://github.com/veritas123-s/Medstack-Program/releases/download/v5.1.0/Medstack-Setup-5.1.0-x64.exe",
          sha256: "a".repeat(64),
        },
      },
    };
    b.releases.clock = () => Date.now();
    b.releases.accept(release);
    await req("/api/releases/preferences", { emailUpdates: false }, c);
    await b.releases.drain();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].email, "a@synthetic.invalid");
    b.releases.accept(release);
    await b.releases.drain();
    assert.equal(outbox.length, 1);
    assert.equal(
      (await req("/api/releases/latest", undefined, undefined, false)).data
        .release.version,
      "5.1.0",
    );
    const unsubscribe = new URL(outbox[0].unsubscribeURL);
    assert.equal(
      (
        await req(
          unsubscribe.pathname + unsubscribe.search,
          {},
          undefined,
          false,
        )
      ).data.unsubscribed,
      true,
    );
    assert.equal(
      (await req("/api/releases/preferences", undefined, a)).data.emailUpdates,
      false,
    );
    assert.equal(
      (await req("/updates/unsubscribe?token=bad", {}, undefined, false))
        .status,
      400,
    );
    const mail = releaseEmail(outbox[0]);
    assert.match(mail.subject, /医栈通/);
    assert.match(mail.text, /取消订阅/);
    assert.ok(!mail.text.includes("password"));
    b.close();
    b = await createBackend(options);
    b.releases.accept(release);
    await b.releases.drain();
    assert.equal(outbox.length, 1);
  } finally {
    b.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
