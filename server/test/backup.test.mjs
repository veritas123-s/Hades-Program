import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupStore } from "../backup.mjs";

test("在线备份包含 WAL 写入，复制配置，可独立恢复，重复备份不覆盖", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "medstack-backup-"));
  const db = new DatabaseSync(path.join(root, "medstack.sqlite"));
  try {
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO sample VALUES (1, 'synthetic');",
    );
    const config = JSON.stringify({
      secret: "synthetic-test-secret-only-not-a-real-credential",
    });
    await fs.writeFile(path.join(root, "config.json"), config);
    const first = await backupStore(root);
    db.exec("INSERT INTO sample VALUES (2, 'later');");
    const second = await backupStore(root);
    assert.notEqual(first, second);
    for (const [directory, count] of [
      [first, 1],
      [second, 2],
    ]) {
      const restored = new DatabaseSync(path.join(directory, "medstack.sqlite"), {
        readOnly: true,
      });
      try {
        assert.equal(
          restored.prepare("SELECT COUNT(*) n FROM sample").get().n,
          count,
        );
      } finally {
        restored.close();
      }
      assert.equal(
        await fs.readFile(path.join(directory, "config.json"), "utf8"),
        config,
      );
      assert.equal(
        JSON.parse(await fs.readFile(path.join(directory, "manifest.json")))
          .verified,
        true,
      );
    }
    await assert.rejects(backupStore(path.join(root, "missing")));
    assert.equal(db.prepare("SELECT COUNT(*) n FROM sample").get().n, 2);
  } finally {
    db.close();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("medstack-backup-"));
    await fs.rm(root, { recursive: true, force: true });
  }
});
