import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import * as asar from "@electron/asar";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const directory = pkg.build.directories.output;
const archive = path.join(directory, "win-unpacked/resources/app.asar");
const entries = asar
  .listPackage(archive)
  .map((name) => name.replace(/^[/\\]/, "").replaceAll("\\", "/"));
const findings = [];
let scanned = 0;
const patterns = [
  ["api-key", /\bsk-[A-Za-z0-9_-]{18,}/],
  ["cloud-key", /\bAKID[A-Za-z0-9]{20,}/],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["wechat-local-identity", /wxid_[a-z0-9]{10,}/],
];
for (const name of entries) {
  if (asar.statFile(archive, path.normalize(name)).files) continue;
  if (
    /(^|\/)(local-ops|test-results|backups|server|android|miniprogram)(\/|$)/.test(
      name,
    ) &&
    !name.startsWith("node_modules/")
  )
    findings.push({ name, kind: "unexpected-file" });
  if (!/\.(mjs|cjs|js|json|md|txt|html|svg)$/.test(name)) continue;
  scanned++;
  const text = asar.extractFile(archive, path.normalize(name)).toString("utf8");
  for (const [kind, pattern] of patterns)
    if (pattern.test(text)) findings.push({ name, kind });
}
for (const file of [
  "src/domain/workhub.mjs",
  "src/agent/research-tool.mjs",
  "electron/commands/workhub.mjs",
  "electron/commands/workspace.mjs",
  "src/cloud-data.mjs",
  "src/domain/migrations.mjs",
]) {
  assert.ok(entries.includes(file), `Missing ${file}`);
  assert.equal(
    asar.extractFile(archive, path.normalize(file)).toString("utf8"),
    fs.readFileSync(file, "utf8"),
    `Stale ${file}`,
  );
}
assert.equal(
  JSON.parse(asar.extractFile(archive, "package.json")).version,
  pkg.version,
);
assert.ok(entries.some((x) => /^dist\/assets\/ResearchPage-.*\.js$/.test(x)));
assert.ok(
  fs.existsSync(
    path.join(directory, "win-unpacked/帮助文档/WORKHUB-GUIDE.html"),
  ),
);
const name = `Medstack-Setup-${pkg.version}-x64.exe`;
const bytes = fs.readFileSync(path.join(directory, name));
assert.ok(bytes.length > 1_000_000);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
fs.mkdirSync("test-results", { recursive: true });
const result = {
  version: pkg.version,
  scanned,
  findings,
  file: { name, bytes: bytes.length, sha256 },
};
fs.writeFileSync(
  "test-results/workhub-package-audit.json",
  JSON.stringify(result, null, 2),
);
fs.writeFileSync(
  path.join(directory, "SHA256SUMS.txt"),
  `${sha256}  ${name}\n`,
);
console.log(JSON.stringify(result));
assert.deepEqual(findings, []);
