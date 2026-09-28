import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function backupStore(directory) {
  const root = path.resolve(directory);
  for (const name of ["hades.sqlite", "config.json"]) {
    const stat = await fs.lstat(path.join(root, name));
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error("Backup requires regular database and configuration files");
  }
  const createdAt = new Date().toISOString();
  const name = `${createdAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const parent = path.join(root, "backups");
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  if ((await fs.lstat(parent)).isSymbolicLink())
    throw Error("Backup directory must not be a symbolic link");
  const pending = path.join(parent, `${name}.pending`);
  await fs.mkdir(pending, { mode: 0o700 });
  const source = new DatabaseSync(path.join(root, "hades.sqlite"), {
    readOnly: true,
  });
  try {
    await backup(source, path.join(pending, "hades.sqlite"));
  } finally {
    source.close();
  }
  const check = new DatabaseSync(path.join(pending, "hades.sqlite"), {
    readOnly: true,
  });
  try {
    if (check.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw Error("Backup integrity check failed");
  } finally {
    check.close();
  }
  await fs.copyFile(
    path.join(root, "config.json"),
    path.join(pending, "config.json"),
  );
  await fs.writeFile(
    path.join(pending, "manifest.json"),
    JSON.stringify({ createdAt, schema: 1, verified: true }),
    { flag: "wx", mode: 0o600 },
  );
  const result = path.join(parent, name);
  await fs.rename(pending, result);
  return result;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    await backupStore(
      process.env.HADES_SERVER_DATA ||
        path.join(path.dirname(fileURLToPath(import.meta.url)), "data"),
    );
    console.log("Hades backup created and verified.");
  } catch {
    console.error(
      "Hades backup failed; existing data and backups were retained.",
    );
    process.exitCode = 1;
  }
}
