import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validId } from "../src/platform/model.mjs";
const args = process.argv.slice(2),
  id = args[args.indexOf("--id") + 1],
  title = args[args.indexOf("--title") + 1];
if (
  !args.includes("--id") ||
  !validId(id) ||
  !args.includes("--title") ||
  !title?.trim() ||
  title.length > 60
) {
  console.error(
    '用法：npm run scaffold:widget -- --id reading-card --title "阅读卡片"',
  );
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(
  root,
  "src",
  "extensions",
  "widgets",
  id + ".widget.jsx",
);
const source = `import React from 'react';
import {defineWidget} from '../../sdk/widget.mjs';

function Widget({config,actions}) {
  return <section className="panel"><h3>{${JSON.stringify(title.trim())}}</h3><p className="hint">从这个小组件开始，逐步加入自己的功能。</p><button className="button" onClick={()=>actions.configure({count:(config.count||0)+1})}>已记录 {config.count||0} 次</button></section>;
}

export default defineWidget({id:${JSON.stringify(id)},title:${JSON.stringify(title.trim())},description:'自定义工作台小组件',defaults:{count:0},Component:Widget});
`;
try {
  fs.writeFileSync(file, source, { encoding: "utf8", flag: "wx" });
  console.log(
    `已创建 ${file}\n构建后可在“主题与小组件”中添加，已有文件不会被覆盖。`,
  );
} catch (error) {
  if (error.code === "EEXIST") throw new Error("此小组件已存在，未覆盖原文件");
  throw error;
}
