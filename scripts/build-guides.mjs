import fs from "node:fs";
import path from "node:path";
const out = "docs/offline";
fs.mkdirSync(out, { recursive: true });
const documents = {
  "USER-GUIDE.md": "docs/USER-GUIDE.md",
  "DEVELOPER-HANDBOOK.md": "docs/DEVELOPER-HANDBOOK.md",
  "WIDGET-GUIDE.md": "docs/WIDGET-GUIDE.md",
  "ORIGIN.md": "docs/ORIGIN.md",
  "VALIDATION-V3.1.md": "docs/VALIDATION-V3.1.md",
  "SERVER-README.md": "server/README.md",
};
const escape = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
function inline(text) {
  const fragments = [];
  let safe = escape(text).replace(/`([^`]+)`/g, (_, code) => {
    fragments.push(`<code>${code}</code>`); return `\u0000${fragments.length - 1}\u0000`;
  });
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const file = href === "../server/README.md" ? "SERVER-README.md" : href;
    const dest = Object.hasOwn(documents, file) ? file.replace(/\.md$/, ".html") : /^https:\/\//.test(href) ? href : null;
    return dest ? `<a href="${dest}" rel="noreferrer">${label}</a>` : label;
  }).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
  return safe.replace(/\u0000(\d+)\u0000/g, (_, n) => fragments[n]);
}
function render(md) {
  const lines = md.replace(/\r/g, "").split("\n"), parts = [], toc = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("```")) {
      const code = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++; parts.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`); continue;
    }
    const heading = /^(#{1,4}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length, id = `section-${toc.length}`;
      toc.push({ level, id, title: heading[2] });
      parts.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`); i++; continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++].split("|").slice(1,-1).map(x=>x.trim()));
      parts.push(`<div class="table-wrap"><table><thead><tr>${rows[0].map(x=>`<th>${inline(x)}</th>`).join("")}</tr></thead><tbody>${rows.slice(2).map(row=>`<tr>${row.map(x=>`<td>${inline(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`); continue;
    }
    const list = /^(\d+\.|-) (.+)/.exec(line);
    if (list) {
      const ordered = list[1] !== "-", items = [];
      const pattern = ordered ? /^\d+\. (.+)/ : /^- (.+)/;
      while (i < lines.length && pattern.test(lines[i])) items.push(`<li>${inline(pattern.exec(lines[i++])[1])}</li>`);
      parts.push(`<${ordered?"ol":"ul"}>${items.join("")}</${ordered?"ol":"ul"}>`); continue;
    }
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#|\||```|\d+\. |\- )/.test(lines[i])) para.push(lines[i++]);
    parts.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return { body: parts.join("\n"), toc, title: toc[0]?.title || "Hades 手册" };
}
for (const [name, file] of Object.entries(documents)) {
  const { body, toc, title } = render(fs.readFileSync(file, "utf8"));
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'"><title>${escape(title)}</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f3ee;color:#24252e;font:16px/1.9 'Microsoft YaHei UI','Microsoft YaHei',sans-serif}header{padding:22px 5vw;border-bottom:1px solid #dedbd4;background:#242736;color:#fff}header a{color:#e7d3a5;margin-right:22px}nav{position:fixed;top:110px;bottom:20px;width:265px;padding:10px 24px;overflow:auto}nav a{display:block;padding:5px 0;color:#555b70;font-size:14px;text-decoration:none}main{max-width:1050px;margin:30px 30px 80px 285px;padding:35px 45px;background:#fffdf9;border:1px solid #e3dfd6;border-radius:18px}h1{font-size:30px}h2{margin-top:50px;padding-top:10px;border-top:1px solid #e4e0d8;font-size:24px}h3{margin-top:32px;font-size:19px}a{color:#5b4e88}code{font-family:Consolas,monospace;font-size:.9em;background:#f0edf5;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{overflow:auto;padding:18px;background:#252838;color:#f6f0e2;border-radius:10px}pre code{background:none;color:inherit;white-space:pre}p,li{overflow-wrap:anywhere}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #dedbd3;text-align:left;padding:10px;vertical-align:top}th{background:#efedf4}h1,h2,h3{scroll-margin-top:20px}.intro{color:#cec9d8;font-size:13px}@media(max-width:850px){nav{position:static;width:auto;max-height:260px}main{margin:15px;padding:22px}header{padding:18px}}@media print{nav,header{display:none}body{background:white;font-size:11pt}main{border:0;margin:0;padding:0;max-width:none}h2,h3{break-after:avoid}pre,table{break-inside:avoid}a{color:inherit}h2{margin-top:25px}}
</style><header><strong>HADES / 离线帮助</strong><div><a href="USER-GUIDE.html">使用说明</a><a href="DEVELOPER-HANDBOOK.html">Zeus · 开发者手册</a></div><div class="intro">V3.1 · 无需联网阅读，可使用浏览器查找与打印</div></header><nav aria-label="章节目录">${toc.filter(x=>x.level===2).map(x=>`<a href="#${x.id}">${escape(x.title)}</a>`).join("")}</nav><main>${body}</main></html>`;
  fs.writeFileSync(path.join(out,name.replace(/\.md$/,".html")),html);
}
console.log(`Generated ${Object.keys(documents).length} offline documentation pages.`);
