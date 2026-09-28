import fs from "node:fs";
import path from "node:path";

// Only ciphertext is written. This vault is deliberately excluded from exports.
export class Vault {
  constructor(directory, protection) {
    this.file = path.join(directory, "campus-vault.bin");
    this.protection = protection;
    this.data = { cookies: [], credentials: null, remember: true };
    this.warning = "";
    if (fs.existsSync(this.file)) {
      try {
        if (!protection.isEncryptionAvailable()) throw new Error("locked");
        const value = JSON.parse(
          protection.decryptString(fs.readFileSync(this.file)),
        );
        this.data = {
          cookies: Array.isArray(value.cookies) ? value.cookies : [],
          credentials: value.credentials || null,
          remember: value.remember !== false,
        };
      } catch {
        this.warning = "已保存的学校登录资料无法解密，请重新登录。";
      }
    }
  }
  save(patch) {
    if (!this.protection.isEncryptionAvailable())
      throw new Error("Windows 加密服务不可用，未保存登录资料。");
    const next = { ...this.data, ...patch };
    fs.writeFileSync(
      this.file + ".tmp",
      this.protection.encryptString(JSON.stringify(next)),
      { mode: 0o600 },
    );
    fs.renameSync(this.file + ".tmp", this.file);
    this.data = next;
    this.warning = "";
  }
  clear() {
    fs.rmSync(this.file, { force: true });
    this.data = { cookies: [], credentials: null, remember: false };
    this.warning = "";
  }
  status() {
    return {
      remember: this.data.remember,
      hasCredentials: !!this.data.credentials,
      hasSession: this.data.cookies.length > 0,
      encryptionAvailable: this.protection.isEncryptionAvailable(),
      warning: this.warning,
    };
  }
}
