# 开发一个 Hades 小组件

## 创建与运行

在当前 Hades-Program 仓库根目录执行：

```powershell
npm run scaffold:widget -- --id reading-card --title "阅读卡片"
npm start
```

脚手架在 `src/extensions/widgets/reading-card.widget.jsx` 生成一个可以点击计数、保存独立数据的组件；同名文件不会覆盖。打开“主题与小组件”，添加“阅读卡片”。正式发行需要重新打包应用。仓库内 `quick-note.widget.jsx` 是可使用的完整示例。

## 声明与组件属性

```jsx
import React from "react";
import { defineWidget } from "../../sdk/widget.mjs";

function ReadingCard({ data, config, actions }) {
  return (
    <section className="panel">
      <h3>阅读卡片</h3>
      <p className="hint">
        待办 {data.tasks.filter((t) => !t.completedAt && !t.deletedAt).length}{" "}
        项
      </p>
      <button
        className="button"
        onClick={async () => {
          try {
            await actions.configure({ count: (config.count || 0) + 1 });
          } catch (error) {
            /* 在组件内展示错误，并保留未保存输入 */
          }
        }}
      >
        已读 {config.count || 0} 次
      </button>
    </section>
  );
}

export default defineWidget({
  id: "reading-card",
  title: "阅读卡片",
  description: "记录阅读进度",
  version: "1.0.0",
  apiVersion: 1,
  stateVersion: 1,
  data: ["tasks"],
  commands: [],
  uiActions: [],
  defaultSize: "half",
  defaults: { count: 0 },
  Component: ReadingCard,
});
```

id 使用 2–48 位小写字母、数字或连字符，首字符为字母；发布后保持稳定。title 不超过 60 字。SDK 默认补齐 API/data 版本、能力列表、空数据及半宽尺寸，最终由注册器校验。

- `data`：只传递声明过的 tasks、logs、settings、timer、cycles、courses、courseRanges、scores。读数据不等于获得对应写权限。
- `commands`：当前允许 task.save / complete / delete / restore 和 timer，通过 `actions.call(name, payload)` 调用；未声明操作会拒绝。
- `uiActions`：可声明 navigate、addTask、editTask、focusTask。navigate 使用路由 id，例如 today、tasks、matrix、focus、campus、briefing、workbench。
- `config`：本组件独立数据，无记录时使用 defaults。
- `actions.configure(next)`：替换本组件的完整数据，自动附带本组件 id 和 stateVersion，不覆盖其他组件。请按需要合并旧字段，捕获失败并保留编辑内容。

存储只接受有限深度 JSON，每组件上限 20,000 字符，工作台总计 250,000 字符；不适合直接保存文件、图片和大型文档。需要更多容量时新增主进程服务，不要绕过现有 Store。

## 升级组件数据

当字段含义改变，将 stateVersion 从 1 增到 2，并声明：

```js
stateVersion: 2,
defaults: {count: 0, target: 5},
migrations: {
  2: old => ({...old, target: 5}),
},
```

迁移函数以“目标版本”为键，必须提供连续步骤，不修改传入对象。读取时得到迁移后的 config，下一次成功 configure 才提交新版本；迁移应纯函数且可重复运行。缺少步骤或读到较新数据时，该组件显示局部错误并保留原数据。不要通过修改 id 规避迁移。

## 使用主题

优先复用 panel/button/hint/inline 等通用样式。自定义 CSS 使用 `var(--surface)`、`--surface-soft`、`--text`、`--muted`、`--border`、`--accent`、`--on-accent`、`--danger` 和 `--panel-radius`。组件内不写死全局背景或字体色，不修改其他模块选择器。

新增主题时，在 `src/themes/catalog.mjs` 添加元信息，在 tokens.css 添加 `:root[data-theme="新id"]` 下的变量。额外装饰同样限定主题选择器；原建筑装饰位于 themes/monument.css。App 的主题 hook 自动更新根属性，保存通过 workspace.configure 完成。

## 验证

```powershell
npm test
npm run build
npm run test:platform
```

涉及任务/计时/校园时补跑 `npm run test:desktop`。使用合成数据与独立测试目录；禁止写入真实学校会话、密码或个人资料。至少检查三种主题、组件隐藏再添加、退出重开和备份恢复。涉及新状态版本时加入明确迁移测试。

当前接口服务于可信的本地开发与随包发布。没有运行时第三方插件安装或第三方代码沙箱。
