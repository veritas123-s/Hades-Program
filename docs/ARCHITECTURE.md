# V1.2 模块与扩展结构

## 分层

| 层级       | 入口                                  | 职责                                                 |
| ---------- | ------------------------------------- | ---------------------------------------------------- |
| 应用外壳   | `src/App.jsx`                         | 导航、共享状态订阅、任务编辑弹窗与全局计时入口       |
| 功能模块   | `src/modules/*/module.jsx`            | 页面、侧栏入口及内置组件的声明；页面按需加载         |
| 工作台平台 | `src/platform/`                       | 模块注册、路由分发、组件布局、能力检查、局部错误界面 |
| 扩展组件   | `src/extensions/widgets/*.widget.jsx` | 由构建器自动发现，用户在组件库中加入首页             |
| 主题       | `src/themes/`                         | 元信息、语义颜色变量、主题专属装饰                   |
| 领域规则   | `src/domain/`                         | 任务、日期、计时、统计、设置、状态校验与迁移         |
| 桌面命令   | `electron/commands/`                  | 按职责注册命令；唯一写入入口，处理文件、会话、通知等 |
| 数据与连接 | `electron/store.mjs` 及校园/桥接服务  | 原子提交、备份恢复、校园加密会话、快报最小字段导出   |

`src/domain.mjs` 保持旧调用方的导出接口。`Campus.jsx` 和 `Briefing.jsx` 保留兼容转发。旧 Android 源码不参与桌面构建。

## 新功能放在哪里

- 首页信息卡片或轻量交互：新增一个扩展组件，参考 WIDGET-GUIDE。
- 完整功能页面：增加 `src/modules/功能名/module.jsx` 和页面文件。声明稳定的模块 id、apiVersion、order，以及 routes 的 id/title/icon/Component；使用 React.lazy 加载页面。无需修改 App 中的页面分支。
- 可复用业务规则：加入 `src/domain/`，如需对外复用则从 `domain.mjs` 导出。
- 需要系统权限的动作：新增 `electron/commands/` 处理器并在 index.mjs 明确注册名字，校验载荷后通过 Store.change 写入。不要在页面直接访问文件或凭据。
- 新数据字段：在 domain/migrations.mjs 加迁移步骤，同时更新校验、迁移备份与测试；不要仅修改版本数字。

模块清单版本和数据版本独立。宿主扩展 API 当前为 1；整体数据 schemaVersion 为 3；workspace.version 为 1；每个小组件还有各自 stateVersion。

## 持久化与升级

主进程持有唯一真实状态。界面操作通过预加载桥发送命令；主进程校验、原子保存、广播带 revision 的快照。外观配置单独保存在 workspace，切换主题不重建计时或校园服务。

迁移链明确为 1 → 2 → 3。读取旧版数据时先生成 pre-v1.2 原始副本；发现更新版本的数据立即拒绝载入，不回退到较旧的 .bak。原有损坏文件恢复机制继续保留。自动化测试覆盖两种情况。

workspace 保存 theme、widgets 的 order/hidden/sizes、widgetData 的独立记录。未安装组件的 id 和记录保留，未来重新装入时仍可使用。重置布局只恢复显示安排，主题与组件记录不变。完整备份导入导出覆盖这些字段。

## 边界与后续扩展

小组件能力声明用于约束项目内 API 使用；这些组件与应用一起编译，是可信项目代码。它不构成第三方代码安全沙箱：JavaScript 仍处于同一个渲染进程。不兼容的组件清单会跳过；渲染或组件数据迁移异常显示局部提示。语法错误、顶层导入异常、异步事件异常不属于 React 错误边界能够全部隔离的范围。

后续可以在这层接入日历、阅读卡、习惯、统计卡片。运行时插件安装、扩展权限确认、沙箱、包签名、依赖管理及自动更新尚未实现，届时应作为单独的平台版本设计。

校园、快报和提醒保留现有独立模块。V1.2 未更改云端部署或定时任务；持续自动上传和学校实网认证仍沿用 V1.1 的待验收事项。此处的“随手记”不会自动变成微信提醒。

## V1.3 助手与同步

`src/modules/assistant` 为独立页面及全局侧边助手；`src/assistant.mjs` 为最小上下文、模型输出解析和原子批量添加规则。`electron/assistant-service.mjs` 负责唯一学校端点、请求限额、取消、历史和去重。模型无系统操作能力，输出先解析为草稿，再由明确的 `assistant.commit` 提交事务。

`electron/cloud-sync.mjs` 从快报桥接接收快照，合并队列、签名上传、核对确认摘要并退避重试。`integration/cloud` 为标准库实现的函数入口、COS 持久化和快报读取器，所有 HTTP 请求先经独立鉴权处理，不能触发推送。

助手历史独立保存在 `assistant-history.json`；Windows safeStorage 分别保护 `assistant-vault.bin`、`cloud-vault.bin`。密钥不进任务 JSON、导出备份或渲染状态。schemaVersion 仍为 3，不需要更改 V1.2 业务字段；已添加草稿的任务 ID 本身提供重启后的去重依据。
