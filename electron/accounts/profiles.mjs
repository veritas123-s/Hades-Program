import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export class AccountProfiles {
  constructor(root, secrets) {
    this.root = root;
    this.secrets = secrets;
    this.active = secrets.load().active || null;
  }
  directory(user = this.active) {
    return user
      ? path.join(
          this.root,
          "accounts",
          createHash("sha256").update(user.id).digest("hex"),
        )
      : this.root;
  }
  select(user) {
    this.secrets.save({ active: user });
    this.active = user;
  }
  canImportLegacy(user) {
    const owner = this.secrets.load().legacyOwner;
    return !owner || owner === user.id;
  }
  prepare(user, seed) {
    const directory = this.directory(user);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "veritas-data.json");
    if (!fs.existsSync(file) && seed) {
      if (!this.canImportLegacy(user)) throw Error("本机旧数据已归属其他账号");
      // Claim once before copying. Never carry an account session into another space.
      this.secrets.save({ legacyOwner: user.id });
      for (const name of [
        "assistant-vault.bin",
        "campus-vault.bin",
        "learning-vault.bin",
        "cloud-vault.bin",
        "cloud-setup-vault.bin",
        "assistant-history.json",
        "learning-cache.json",
        "hades-workflows.json",
        "bridge-config.json",
      ]) {
        const source = path.join(this.root, name),
          destination = path.join(directory, name);
        if (fs.existsSync(source) && !fs.existsSync(destination))
          fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      }
      const backgrounds = path.join(this.root, "theme-backgrounds");
      if (fs.existsSync(backgrounds))
        fs.cpSync(backgrounds, path.join(directory, "theme-backgrounds"), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      fs.writeFileSync(file, JSON.stringify(seed), { mode: 0o600, flag: "wx" });
    }
    return directory;
  }
}
