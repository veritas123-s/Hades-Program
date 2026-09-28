import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createBackend } from "../backend.mjs";
import { cloudDocument } from "../../src/cloud-data.mjs";
import { initialState, taskInput } from "../../src/domain.mjs";
test("真实认证库：邮箱验证、账号隔离、并发版本、密码找回与会话撤销", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hades-server-")),
    outbox = [];
  const b = await createBackend({
    database: path.join(directory, "test.sqlite"),
    baseURL: "http://localhost:4318",
    secret: "synthetic-only-secret-not-for-production-0000",
    testMode: true,
    sendEmail: async (message) => outbox.push(message),
  });
  const req = async (route, body, token) => {
    const r = await b.handle(
      new Request("http://localhost:4318" + route, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    return {
      status: r.status,
      token: r.headers.get("set-auth-token"),
      data: await r.json(),
    };
  };
  const signup = async (email) => {
    const s = await req("/api/auth/sign-up/email", {
      email,
      password: "Synthetic123!Test",
      name: "合成用户",
    });
    assert.equal(s.status, 200, JSON.stringify(s.data));
    const premature = await req("/api/auth/sign-in/email", {
      email,
      password: "Synthetic123!Test",
    });
    assert.notEqual(premature.status, 200);
    const otp = outbox.filter((m) => m.email === email).at(-1).otp;
    const verified = await req("/api/auth/email-otp/verify-email", {
      email,
      otp,
    });
    assert.equal(verified.status, 200, JSON.stringify(verified.data));
    assert.ok(verified.token);
    return verified.token;
  };
  try {
    const a = await signup("a@synthetic.invalid"),
      bt = await signup("b@synthetic.invalid");
    const doc = cloudDocument(initialState());
    doc.tasks = [taskInput({ title: "甲的事项", quadrant: "plan" })];
    assert.equal((await req("/api/sync", { action: "pull" })).status, 401);
    assert.equal(
      (await req("/api/sync", { action: "push", version: 0, document: doc }, a))
        .data.version,
      1,
    );
    assert.equal(
      (await req("/api/sync", { action: "pull" }, bt)).data.document,
      null,
    );
    assert.equal(
      (await req("/api/sync", { action: "pull", uid: "a" }, bt)).status,
      400,
    );
    assert.equal(
      (await req("/api/sync", { action: "push", version: 0, document: doc }, a))
        .data.conflict,
      true,
    );
    const race = await Promise.all([
      req("/api/sync", { action: "push", version: 1, document: doc }, a),
      req("/api/sync", { action: "push", version: 1, document: doc }, a),
    ]);
    assert.equal(
      race.filter((r) => r.data.version === 2 && !r.data.conflict).length,
      1,
    );
    assert.equal(race.filter((r) => r.data.conflict).length, 1);
    assert.equal(
      b.db.prepare("SELECT count(*) AS n FROM hades_history").get().n,
      1,
    );
    await req("/api/auth/email-otp/request-password-reset", {
      email: "a@synthetic.invalid",
    });
    const otp = outbox.at(-1).otp;
    assert.equal(
      (
        await req("/api/auth/email-otp/reset-password", {
          email: "a@synthetic.invalid",
          otp,
          password: "NewSynthetic123!",
        })
      ).status,
      200,
    );
    assert.equal((await req("/api/sync", { action: "pull" }, a)).status, 401);
    const login = await req("/api/auth/sign-in/email", {
      email: "a@synthetic.invalid",
      password: "NewSynthetic123!",
    });
    assert.equal(login.status, 200);
    assert.ok(login.token);
    assert.equal(
      (await req("/api/sync", { action: "pull" }, login.token)).data.document
        .tasks[0].title,
      "甲的事项",
    );
    await req("/api/auth/sign-out", {}, login.token);
    assert.equal(
      (await req("/api/sync", { action: "pull" }, login.token)).status,
      401,
    );
    const saved = b.db
      .prepare("SELECT password FROM account WHERE password IS NOT NULL")
      .all();
    assert.ok(saved.every((x) => !x.password.includes("Synthetic")));
  } finally {
    b.close();
  }
});
