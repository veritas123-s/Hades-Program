import fs from "node:fs";
const target = new URL("../electron/cloud/runtime/", import.meta.url);
fs.mkdirSync(target, { recursive: true });
for (const name of ["index.py", "veritas_bridge.py", "veritas_sync.py"]) {
  const group = name === "index.py" ? "classmate" : "cloud";
  fs.copyFileSync(
    new URL(`../integration/${group}/${name}`, import.meta.url),
    new URL(name, target),
  );
}
