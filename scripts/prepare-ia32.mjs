import { downloadArtifact } from "@electron/get";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const version = "43.7.5",
  directory = path.resolve(".cache/electron-" + version + "-ia32");
if (!fs.existsSync(path.join(directory, "electron.exe"))) {
  const archive = await downloadArtifact({
    version,
    platform: "win32",
    arch: "ia32",
    artifactName: "electron",
  });
  fs.mkdirSync(directory, { recursive: true });
  execFileSync("tar.exe", ["-xf", archive, "-C", directory], {
    stdio: "inherit",
  });
}
const pe = fs.readFileSync(path.join(directory, "electron.exe"));
if (pe.readUInt16LE(pe.readUInt32LE(0x3c) + 4) !== 0x14c)
  throw Error("Runtime is not Windows x86");
console.log("Verified Windows x86 runtime " + version);
