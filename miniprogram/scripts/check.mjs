import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
const root = fileURLToPath(new URL("..", import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
let files = 0;
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["artifacts", "scripts", "tests"].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith(".js")) {
      new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
      files++;
    } else if (file.endsWith(".json")) {
      JSON.parse(fs.readFileSync(file, "utf8"));
      files++;
    }
  }
}
walk(root);
const allowedTags = new Set([
  "root",
  "view",
  "text",
  "image",
  "button",
  "input",
  "picker",
  "switch",
  "block",
]);
for (const page of config.pages) {
  const source = fs.readFileSync(path.join(root, page + ".js"), "utf8");
  // Top-level module dependencies are safe local source, evaluated by the page test suite.
  const template = fs.readFileSync(path.join(root, page + ".wxml"), "utf8");
  const errors = [];
  const normalized = template
    .replace(/\bpassword(?=\s)/g, 'password="true"')
    .replace(/wx:else(?=>|\s)/g, 'wx:else=""');
  const document = new DOMParser({
    errorHandler: {
      warning: (message) => errors.push(message),
      error: (message) => errors.push(message),
      fatalError: (message) => errors.push(message),
    },
  }).parseFromString(
    '<root xmlns:wx="wx">' + normalized + "</root>",
    "text/xml",
  );
  if (errors.length) throw Error(page + ": " + errors.join("; "));
  const nodes = document.getElementsByTagName("*");
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!allowedTags.has(node.tagName))
      throw Error(page + ": unexpected tag " + node.tagName);
    for (let j = 0; j < node.attributes.length; j++) {
      const attr = node.attributes[j];
      if (
        /^wx:(if|elif|for)$/.test(attr.name) &&
        !/^{{[\s\S]+}}$/.test(attr.value)
      )
        throw Error(page + ": missing expression binding " + attr.name);
      if (
        /^(bind|catch)/.test(attr.name) &&
        !new RegExp("(?:async\\s+)?" + attr.value + "\\s*\\(").test(source)
      )
        throw Error(page + ": missing handler " + attr.value);
    }
  }
  files++;
}
for (const item of config.tabBar.list)
  if (!config.pages.includes(item.pagePath)) throw Error("Unknown tab route");
const bundle = fs.readFileSync(path.join(root, "lib/domain.js"), "utf8");
if (
  /structuredClone|TextEncoder|crypto\.randomUUID|require\("node:/.test(bundle)
)
  throw Error("Unsupported platform primitive in bundle");
const settings = fs.readFileSync(
  path.join(root, "pages/settings/index.wxml"),
  "utf8",
);
if (!settings.includes("首页小组件") || !settings.includes("主题"))
  throw Error("Missing settings sections");
console.log(
  `Checked ${files} runtime files, ${config.pages.length} pages, template tags, handlers, routes and bundle compatibility.`,
);
