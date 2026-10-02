// Static layout QA of actual WXML data and WXSS; this is not a native WeChat renderer.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const { harness, event } = require("../tests/harness.cjs");
const root = fileURLToPath(new URL("..", import.meta.url));
const out = path.join(root, "artifacts");
fs.mkdirSync(out, { recursive: true });
const escape = (text) =>
  String(text == null ? "" : text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function evaluate(expression, scope) {
  try {
    return vm.runInNewContext(expression, scope, { timeout: 1000 });
  } catch (error) {
    throw Error(
      `Template expression ${JSON.stringify(expression)}: ${error.message}`,
    );
  }
}
function interpolate(value, scope) {
  return value.replace(/{{([\s\S]*?)}}/g, (_, expression) =>
    escape(evaluate(expression, scope)),
  );
}
function renderChildren(parent, scope) {
  let result = "",
    previousIf = null;
  for (let node = parent.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 3) {
      result += interpolate(node.data, scope);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const attr = (name) => node.getAttribute(name);
    if (node.hasAttribute("wx:for")) {
      const data = evaluate(attr("wx:for").slice(2, -2), scope);
      for (const [index, item] of data.entries()) {
        const clone = node.cloneNode(true);
        clone.removeAttribute("wx:for");
        const holder = node.ownerDocument.createElement("block");
        holder.appendChild(clone);
        result += renderChildren(holder, {
          ...scope,
          [attr("wx:for-item") || "item"]: item,
          index,
        });
      }
      continue;
    }
    if (node.hasAttribute("wx:if")) {
      previousIf = !!evaluate(attr("wx:if").slice(2, -2), scope);
      if (!previousIf) continue;
    } else if (node.hasAttribute("wx:else")) {
      if (previousIf !== false) continue;
      previousIf = null;
    } else previousIf = null;
    if (node.tagName === "block") {
      result += renderChildren(node, scope);
      continue;
    }
    const tag =
      {
        view: "div",
        text: "span",
        picker: "div",
        image: "img",
        switch: "input",
      }[node.tagName] || node.tagName;
    let attributes = "";
    for (const key of ["class", "style", "placeholder", "value", "type"])
      if (node.hasAttribute(key))
        attributes += ` ${key}="${interpolate(attr(key), scope)}"`;
    if (
      node.hasAttribute("disabled") &&
      evaluate(attr("disabled").slice(2, -2), scope)
    )
      attributes += " disabled";
    if (node.tagName === "image")
      attributes +=
        ' src="data:image/png;base64,' +
        fs.readFileSync(path.join(root, attr("src"))).toString("base64") +
        '"';
    if (node.tagName === "switch")
      attributes +=
        ' type="checkbox"' +
        (evaluate(attr("checked").slice(2, -2), scope) ? " checked" : "");
    if (node.hasAttribute("password")) attributes += ' type="password"';
    result +=
      `<${tag}${attributes}>` +
      (["img", "input"].includes(tag)
        ? ""
        : renderChildren(node, scope) + `</${tag}>`);
  }
  return result;
}
const css = fs
  .readFileSync(path.join(root, "app.wxss"), "utf8")
  .replace(/^page\s*\{/gm, "body {")
  .replace(/\bview(?=[\s,{])/g, "div")
  .replace(/(-?[\d.]+)rpx/g, (_, n) => `calc(var(--rpx) * ${n})`);
const h = harness();
h.app.demo();
const browser = await chromium.launch({
  headless: true,
  channel: process.env.MEDSTACK_BROWSER_CHANNEL || "msedge",
});
const reports = [];
try {
  const context = await browser.newContext();
  const browserPage = await context.newPage();
  for (const width of [320, 390, 768]) {
    await browserPage.setViewportSize({ width, height: 844 });
    for (const name of [
      "login",
      "home",
      "tasks",
      "schedule",
      "focus",
      "profile",
      "settings",
    ]) {
      const page = h.page(name);
      if (name === "focus") page.onHide();
      const template = fs
        .readFileSync(path.join(root, "pages", name, "index.wxml"), "utf8")
        .replace(/\bpassword(?=\s)/g, 'password="true"')
        .replace(/wx:else(?=>|\s)/g, 'wx:else=""');
      const doc = new DOMParser().parseFromString(
        '<root xmlns:wx="wx">' + template + "</root>",
        "text/xml",
      );
      const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>医栈通 · ${name}（静态预览）</title><style>:root{--rpx:${Math.min(width, 480) / 750}px}body{margin:0}button,input{font:inherit;border:0}input{outline:none;min-width:0}img{object-fit:contain} ${css}</style></head><body>${renderChildren(doc.documentElement, page.data)}</body></html>`;
      await browserPage.setContent(html);
      await browserPage.evaluate(() => document.fonts.ready);
      const overflow = await browserPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      if (overflow) throw Error(`Horizontal overflow: ${name} at ${width}`);
      if (width === 390) {
        fs.writeFileSync(path.join(out, name + ".html"), html);
        await browserPage.screenshot({
          path: path.join(out, name + ".png"),
          fullPage: true,
        });
      }
      reports.push({ name, width, overflow });
    }
  }
  // Inspect all eight theme token sets against the same actual home view model.
  for (const theme of require("../lib/domain").THEMES) {
    h.page("settings").theme(event({ id: theme.id }));
    const page = h.page("home");
    if (!page.data.themeStyle.includes("--accent:"))
      throw Error("Missing theme tokens");
  }
  fs.writeFileSync(
    path.join(out, "layout-report.json"),
    JSON.stringify(
      {
        renderer: "Static HTML translation of WXML; native validation pending",
        checks: reports,
      },
      null,
      2,
    ),
  );
  console.log(
    `Static layout checks passed: ${reports.length}; native WeChat compilation and device checks remain pending.`,
  );
} finally {
  await browser.close();
}
