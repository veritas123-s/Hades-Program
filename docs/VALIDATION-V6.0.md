# 医栈通 V6.0 工作台验证记录

2026-10-03。本轮沿用 Windows Medstack，完成工作台、项目、任务、知识库、日程与 Poseidon 的个人学习科研闭环。依据用户最终要求，界面名称为「工作台」，移除送审登记入口、表单、数据操作、检索与相关使用说明。

## 实现范围与检查文件

检查现有模块注册、导航、任务与日程领域模型、账号门禁、Store 原子事务、数据迁移、云同步、助手工具与发行流程。新增 `src/modules/research/`、`src/domain/workhub.mjs`、`electron/commands/workhub.mjs` 和 `src/agent/research-tool.mjs`；修改 `App.jsx`、导航、状态迁移、助手上下文和云同步兼容层。增加工作台操作指南、验收脚本与发行说明，版本设为6.0.0。

项目支持阶段、目标、期限、里程碑、稳定ID关联的任务与日程，以及任务完成率和原始专注投入汇总。知识支持四类模板、标签、来源、纯文本正文、最近20版修订、恢复与回收站。全局搜索可跨项目、知识、任务和日程打开记录。知识默认不提供给模型，只有逐篇授权后可通过只读工具检索；每次调用读取当前权限，恢复历史正文会关闭授权。

本机数据 schema 5 → 6 留存迁移前备份，所有新命令通过账号检查。云协议继续保持5，远端恢复不覆盖本机 workhub 或降级版本。工作区恢复默认设置会保留导航与新手引导完成状态，避免再次弹出引导。

## 执行与验证

- `npm test`：156/156通过，包含迁移、重启、事务回滚、过期编辑、项目关联、软删除、修订恢复、助手权限、实际Pi工具循环及云端v5兼容。
- `npm --prefix server test`：6/6通过。
- `npm run build` 与 `npm run dist:installer`：成功，构建7份离线帮助文档及Windows x64 NSIS安装器。
- `npm run test:desktop`：18项通过；`npm run test:assistant`：6项通过；`npm run test:platform`：6项通过。
- `node scripts/workhub-ui-test.mjs release-medstack-6.0.0/win-unpacked/Medstack.exe`：最终发行程序7组操作通过；3页面×3窗口尺寸无横向溢出，8主题可用；备份导出/恢复与关闭重启后数据一致，登出后个人数据不可见且写入被拒绝。
- `node scripts/compact-ui-test.mjs release-medstack-6.0.0/win-unpacked/Medstack.exe`：66项布局检查通过，覆盖8主题、62条合成任务、侧栏收起与补记。
- `node scripts/medstack-package-test.mjs release-medstack-6.0.0/win-unpacked/Medstack.exe`：实际发行程序Pi两步工具调用、用户核对后入库、密钥不进入上下文与历史通过。
- `node scripts/research-package-audit.mjs`：6302个包内文本扫描无秘密模式命中；核心源文件与包内文件逐字一致；工作台页面、离线指南存在。
- 本地源码隐私扫描350文件无命中；新增模块及脚本Prettier检查通过；`git diff --check`通过。全仓库格式检查仍存在既有格式问题，本轮未统一改写历史文件。
- 使用合成账号与测试目录。工作台及项目截图已核对，标题为「工作台」，没有送审入口；未读写真实任务、研究正文或专注记录。

## 发行物与边界

安装器：`release-medstack-6.0.0/Medstack-Setup-6.0.0-x64.exe`，120636577字节。SHA256：`c91015aa485cd665945cce35b75465789f59ffdec1e244614799dc9802a0237c`。

新项目、知识、修订及操作记录仅保存在当前登录账号本机，可通过完整备份迁移；尚无多人组织权限或协同编辑。既有云同步继续处理任务、日程和专注等原字段。未调用真实学校模型服务验证新检索；模型循环使用合成响应。没有商业代码签名，未进行干净系统安装卸载或本机真实升级。

Android保持历史归档，独立小程序和并行的二维码开发未改动。开发位于独立 `codex/medstack-research-6.0` 工作树。共享上下文建议记录最终名称、取消送审、发行及本机数据边界；确认发行后补记，不能将发行构建视为用户已经安装。
