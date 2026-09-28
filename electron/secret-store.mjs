import fs from "node:fs";
import path from "node:path";
export class SecretStore {
  load() {
    return { ...this.data };
  }
  clear() {
    if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
    this.data = {};
    this.warning = "";
  }
  constructor(directory, name, protection) {
    this.file = path.join(directory, name);
    this.protection = protection;
    this.data = {};
    this.warning = "";
    if (fs.existsSync(this.file))
      try {
        if (!protection.isEncryptionAvailable()) throw new Error();
        if (fs.statSync(this.file).size > 65536) throw new Error();
        this.data = JSON.parse(
          protection.decryptString(fs.readFileSync(this.file)),
        );
        if (
          !this.data ||
          typeof this.data !== "object" ||
          Array.isArray(this.data)
        )
          throw new Error();
      } catch {
        this.data = {};
        this.warning = "本机加密配置无法读取，请重新配置。";
      }
  }
  save(patch) {
    if (!this.protection.isEncryptionAvailable())
      throw new Error("Windows 加密不可用，未保存密钥");
    const next = { ...this.data, ...patch };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      this.file + ".tmp",
      this.protection.encryptString(JSON.stringify(next)),
      { mode: 0o600 },
    );
    fs.renameSync(this.file + ".tmp", this.file);
    this.data = next;
    this.warning = "";
  }
}
