import { build } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { format } from "prettier";
const root = fileURLToPath(new URL("..", import.meta.url));
const repository = path.resolve(root, "..");
// Adapt only JSON-domain primitives; original desktop sources are untouched.
await build({
  configFile: false,
  root,
  logLevel: "warn",
  plugins: [
    {
      name: "wechat-domain-primitives",
      transform(code, id) {
        if (!id.replaceAll("\\", "/").includes("/src/")) return;
        return code
          .replace(
            "globalThis.crypto.randomUUID()",
            "`mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`",
          )
          .replace(
            /structuredClone\((input|current)\)/g,
            "JSON.parse(JSON.stringify($1))",
          )
          .replaceAll(".at(-1)", ".slice(-1)[0]")
          .replace(
            "new TextEncoder().encode(JSON.stringify(document)).length",
            'encodeURIComponent(JSON.stringify(document)).replace(/%[0-9A-F]{2}/g, "x").length',
          );
      },
    },
  ],
  build: {
    outDir: path.join(root, "lib"),
    emptyOutDir: false,
    minify: false,
    target: "es2018",
    lib: {
      entry: path.join(root, "scripts/domain-entry.mjs"),
      formats: ["cjs"],
      fileName: () => "domain.js",
    },
  },
});
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
const bundlePath = path.join(root, "lib/domain.js");
fs.writeFileSync(
  bundlePath,
  await format(fs.readFileSync(bundlePath, "utf8"), { parser: "babel" }),
);
fs.copyFileSync(
  path.join(repository, "assets/icon.png"),
  path.join(root, "assets/icon.png"),
);
console.log("Built shared task, calendar, timer and cloud models for WeChat.");
