# Hades-Program

A tool to bridge the gaps between those complicated apps of SHSMU

## Hades V3.0 · Poseidon（测试版）

Windows 校园与专注工作台：任务清单、四象限、年/月/日日历、校园课表、番茄钟、时间记录、可切换主题，以及可配置模型服务的 Poseidon 助手。

### V3.0

- 安装向导支持选择目录，提供 x64 与 ia32 两种单文件安装包。
- 中文界面、固定品牌图形、侧栏独立滚动、单层搜索焦点与圆角按钮；保留七主题。
- 通用 ICS 日历导入预览、去重与导出；已有任务和专注记录不受日历导入影响。
- 云端账号与同步后台已部署到现有腾讯云 CVM，受信任 HTTPS、低权限运行、服务重启、在线备份及真实中文邮件已验证。两个真实账号在不同电脑上的完整验收仍待完成。详见 [服务器部署](server/README.md) 与 [验证记录](docs/VALIDATION-V3.0.md)。

### 并入本版的 V2.3 修复

- 学习通默认只提醒近30天通知及近期未完成作业，往年、完成、已截止或待确认事项归入历史。
- 逐门课程可选择自动筛选、关注或不关注；只有月日的期限不会自动变成任务 DDL。
- 删除通知在全部、未读、助手摘要中一致生效，兼容平台 ID 与 UUID，重启和再次同步保持隐藏。
- 作业删除与关联本机任务联动，可在已删除列表恢复。不更改学习通服务器。

### 本地开发

已在 Windows x64、Node.js 25.8.2 环境构建验证。

```powershell
npm ci
npm test
npm run build
npm start
```

界面验证：`npm run test:desktop`、`npm run test:platform`、`npm run test:assistant`、`node scripts/v2.3-test.mjs`。这些检查使用临时测试数据，不使用个人账号。先运行 `npm run test:desktop` 创建测试输出目录。

生成单文件安装包：

```powershell
npm run dist:installer
```

目标输出为 `release-v3.0/Hades-Setup-3.0.0-x64.exe`；32 位使用 `npm run dist:installer:ia32`。同学只需安装包，不需要 Node.js 或开发环境。当前提供测试版；源码仓库不存放个人配置与安装包。

### 使用与数据

各人配置自己的 API、校园和学习通账号。校园与学习通首次在官方页面登录；会话在本机加密保存。云端微信快报需各自开通腾讯云及接收端并承担实际资源费用。应用关闭后，新课程与作业不会继续从学习通拉取；云端使用最后同步的任务与课表摘要。

沿用 `%APPDATA%/AI-VERITAS` 与应用 ID `local.ai.veritas`。升级前从托盘退出旧版并备份；旧版已入库任务保留，V2.3 会从通知推荐及助手摘要中排除历史来源事项，任务清单可手动处理。

[使用说明](docs/安装后使用说明.txt) · [模块结构](docs/ARCHITECTURE.md) · [小组件开发](docs/WIDGET-GUIDE.md) · [来源及许可](docs/ORIGIN.md) · [版本记录](CHANGELOG.md)

本项目尚未声明通用开源许可。保留上游来源及第三方许可；学校和学习通页面变化可能需要更新连接器。自动建任务权限仅限应用内，不代答或代交作业。
