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
  prepare(user, seed) {
    const directory = this.directory(user);
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, "veritas-data.json");
    if (!fs.existsSync(file) && seed) {
      fs.writeFileSync(file, JSON.stringify(seed), { mode: 0o600, flag: "wx" });
    }
    return directory;
  }
}
