import fs from "node:fs";
import crypto from "node:crypto";
import {
  RELEASE_FEED,
  validateRelease,
  newerVersion,
} from "../src/releases.mjs";
export class ReleaseHub {
  constructor({
    db,
    baseURL,
    catalogFile,
    sendUpdateEmail,
    clock = () => Date.now(),
    fetcher = fetch,
  }) {
    Object.assign(this, {
      db,
      baseURL,
      catalogFile,
      sendUpdateEmail,
      clock,
      fetcher,
    });
    this.release = null;
    this.draining = false;
    db.exec(`CREATE TABLE IF NOT EXISTS medstack_release_preferences(uid TEXT PRIMARY KEY,email_updates INTEGER NOT NULL DEFAULT 0,subscribed_at INTEGER NOT NULL,unsubscribe_token TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS medstack_release_outbox(uid TEXT NOT NULL,version TEXT NOT NULL,release_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,PRIMARY KEY(uid,version));`);
    this.preference = db.prepare(
      "SELECT email_updates FROM medstack_release_preferences WHERE uid=?",
    );
  }
  preferences(uid) {
    return { emailUpdates: this.preference.get(uid)?.email_updates === 1 };
  }
  setPreferences(uid, body) {
    if (
      !body ||
      typeof body.emailUpdates !== "boolean" ||
      Object.keys(body).some((k) => k !== "emailUpdates")
    )
      throw Error("INVALID_PREFERENCES");
    const current = this.preference.get(uid);
    if (current?.email_updates === (body.emailUpdates ? 1 : 0))
      return this.preferences(uid);
    this.db
      .prepare(
        "INSERT INTO medstack_release_preferences(uid,email_updates,subscribed_at,unsubscribe_token) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET email_updates=excluded.email_updates,subscribed_at=excluded.subscribed_at",
      )
      .run(
        uid,
        body.emailUpdates ? 1 : 0,
        this.clock(),
        crypto.randomBytes(32).toString("hex"),
      );
    if (!body.emailUpdates)
      this.db
        .prepare(
          "UPDATE medstack_release_outbox SET status='cancelled' WHERE uid=? AND status='pending'",
        )
        .run(uid);
    return this.preferences(uid);
  }
  unsubscribe(token) {
    if (!/^[a-f0-9]{64}$/.test(token || "")) return false;
    const row = this.db
      .prepare(
        "SELECT uid FROM medstack_release_preferences WHERE unsubscribe_token=?",
      )
      .get(token);
    if (!row) return false;
    this.setPreferences(row.uid, { emailUpdates: false });
    return true;
  }
  accept(input) {
    const release = validateRelease(input);
    if (Date.parse(release.publishedAt) > this.clock() + 300000)
      throw Error("Release is not yet published");
    if (this.release && newerVersion(this.release.version, release.version))
      throw Error("Release downgrade rejected");
    this.release = release;
    this.db
      .prepare(
        `INSERT OR IGNORE INTO medstack_release_outbox(uid,version,release_json,created_at)
      SELECT p.uid,?,?,? FROM medstack_release_preferences p JOIN user u ON u.id=p.uid
      WHERE p.email_updates=1 AND u.emailVerified=1 AND p.subscribed_at<?`,
      )
      .run(
        release.version,
        JSON.stringify(release),
        this.clock(),
        Date.parse(release.publishedAt),
      );
    return release;
  }
  async refresh() {
    try {
      return await this.refreshRemote();
    } catch (e) {
      if (this.catalogFile && fs.existsSync(this.catalogFile))
        return this.accept(
          JSON.parse(fs.readFileSync(this.catalogFile, "utf8")),
        );
      throw e;
    }
  }
  async refreshRemote() {
    const r = await this.fetcher(RELEASE_FEED, {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!r.ok) throw Error("Release feed unavailable");
    const reader = r.body?.getReader();
    if (!reader) throw Error("Empty release feed");
    let text = "",
      size = 0;
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          throw Error("Release feed too large");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    return this.accept(JSON.parse(text));
  }
  async drain(limit = 10) {
    if (this.draining || !this.sendUpdateEmail) return { sent: 0, failed: 0 };
    this.draining = true;
    let sent = 0,
      failed = 0;
    try {
      const rows = this.db
        .prepare(
          "SELECT uid,version,release_json FROM medstack_release_outbox WHERE status='pending' ORDER BY created_at LIMIT ?",
        )
        .all(Math.min(10, limit));
      for (const row of rows) {
        const recipient = this.db
          .prepare(
            "SELECT u.email,p.unsubscribe_token FROM medstack_release_preferences p JOIN user u ON u.id=p.uid WHERE p.uid=? AND p.email_updates=1 AND u.emailVerified=1",
          )
          .get(row.uid);
        if (!recipient) {
          this.db
            .prepare(
              "UPDATE medstack_release_outbox SET status='cancelled' WHERE uid=? AND version=?",
            )
            .run(row.uid, row.version);
          continue;
        }
        const claimed = this.db
          .prepare(
            "UPDATE medstack_release_outbox SET status='sending' WHERE uid=? AND version=? AND status='pending'",
          )
          .run(row.uid, row.version);
        if (!claimed.changes) continue;
        try {
          const release = validateRelease(JSON.parse(row.release_json));
          const unsubscribeURL = new URL("/updates/unsubscribe", this.baseURL);
          unsubscribeURL.searchParams.set("token", recipient.unsubscribe_token);
          await this.sendUpdateEmail({
            email: recipient.email,
            release,
            unsubscribeURL: unsubscribeURL.href,
          });
          this.db
            .prepare(
              "UPDATE medstack_release_outbox SET status='sent' WHERE uid=? AND version=?",
            )
            .run(row.uid, row.version);
          sent++;
        } catch {
          this.db
            .prepare(
              "UPDATE medstack_release_outbox SET status='failed' WHERE uid=? AND version=?",
            )
            .run(row.uid, row.version);
          failed++;
        }
      }
    } finally {
      this.draining = false;
    }
    // An interrupted/failed SMTP send is not retried blindly: delivery may already have occurred.
    return { sent, failed };
  }
}
export function releaseEmail({ release, unsubscribeURL }) {
  const checked = validateRelease(release);
  return {
    subject: `医栈通 V${checked.version} ${checked.urgent ? "重要更新" : "已发布"}`,
    text: [
      checked.title,
      "",
      ...checked.notes.map((n) => "• " + n),
      "",
      ...Object.entries(checked.downloads).map(
        ([platform, d]) =>
          `${platform === "windows" ? "Windows" : "安卓"}安装包：${d.url}\nSHA256：${d.sha256}`,
      ),
      "",
      "此邮件发送给已订阅版本更新的账号。",
      `取消订阅：${unsubscribeURL}`,
    ].join("\n"),
  };
}
