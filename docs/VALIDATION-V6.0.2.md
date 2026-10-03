# 医栈通 V6.0.2 验证记录

## 改动

Windows 一键更新校验后直接启动分离的 PowerShell 进程，在本机隔离发行程序中复现：进程结束而脚本没有执行，未留下结果或备份。只取消分离能执行脚本，但完整发行程序退出后更新进程也结束；该中间方案未发布。最终采用分离的 Windows Script Host 启动器，隐藏启动 PowerShell，随机令牌与进程身份确认脚本已执行后才退出应用。失败不关闭主程序。

工作脚本保存数据和程序备份，逐文件核对，核验新程序版本，安装失败恢复旧程序并重新打开。修正备份目录递归参与数据清单的问题；启动时读上次失败结果。Windows Script Host 被禁用或无法启动时显示错误并保留主程序，手动下载入口仍可用。

校园新闻关键词评分与分类屏蔽参考并改写自 SJTU Agent `bffce4c750a41bbfd15c892266f0c7c6e84f6d4f`。新增关键词与主题订阅、分类筛选、关键词和分类屏蔽、重置。设置以账号本机文件保存，不修改文章、来源关注或删除墓碑。分类采用关键词规则，可能漏分，不声明官方分类。

上游完整 MIT 许可与版权声明原样保留，源代码及应用归档、安装目录均附许可；关于页注明开发者 kuan-er 与项目链接。具体功能与来源文件见 [校园快讯订阅](SJTU-AGENT-INTEGRATION.md)。

## 验证命令与边界

```text
npm test
npm run build
npm run dist:installer
node scripts/update-worker-test.mjs
node scripts/update-install-ui-test.mjs release-medstack-6.0.2/win-unpacked/Medstack.exe
node scripts/update-handoff-ui-test.mjs release-medstack-6.0.2/win-unpacked/Medstack.exe
node scripts/news-preferences-ui-test.mjs release-medstack-6.0.2/win-unpacked/Medstack.exe
node scripts/news-visual-ui-test.mjs release-medstack-6.0.2/win-unpacked/Medstack.exe
node scripts/compact-ui-test.mjs release-medstack-6.0.2/win-unpacked/Medstack.exe
node scripts/update-package-audit.mjs
node scripts/research-package-audit.mjs
node ../../local-ops/source-privacy.mjs
git diff --check
node scripts/publish-release.mjs releases/notes-6.0.2.json --publish
```

规则测试161项通过；独立 Windows 工作脚本成功与失败恢复通过。发行程序错误哈希拒绝测试、新闻订阅与屏蔽/重置/重启/删除保留/鸣谢、原图文回归及66项布局测试通过，新闻表单覆盖三种窗口尺寸；主题兼容沿用八主题检查。修复输入草稿被每秒状态广播覆盖的问题，测试包含延迟输入后保存。

最终发行程序完整交接通过：确认工作脚本已执行、旧进程退出、数据与程序备份、安装、版本核验与重新打开均已检查。发行程序实际点击一键更新，合成安装器替换隔离目录的程序，旧进程消失与新程序启动标记分别核验。`test-results/update-handoff-ui.json` 为合成验证记录，不包含个人资料。

最终包主进程、更新器、新闻服务、评分模块与来源许可均与当前源码逐字节一致；MIT 原文与上游一致，归档和安装目录均有完整许可，关于页含作者署名。6304项包内文本、366项源码扫描无敏感信息命中；扫描不构成绝对安全保证。

全部使用隔离合成账号与数据；完整交接使用合成 Windows 安装器，真实 NSIS安装到个人目录、真实账号采集与数据升级未执行。新闻订阅不新增邮件/微信/系统推送，原公开来源可能延迟或遗漏。

安装器：`Medstack-Setup-6.0.2-x64.exe`，120643765字节。SHA256：`24d5ff8be8bdef9c1122181277857437c3799991b394c5bcc6e4ab718e728ebb`。

旧客户端带有原更新缺陷，需要手动安装本版；本轮不把公开发行称为本机已升级。云公告缓存另行核验，不把 GitHub 发布等同于服务器已同步。原主目录正在进行的二维码工作及独立小程序未修改。

发布结果：[GitHub v6.0.2](https://github.com/veritas123-s/Medstack-Program/releases/tag/v6.0.2) 已公开，远端附件大小与 SHA256 digest 和本地一致，标题与说明一致；源码与发行目录已推送 main。2026-10-03 17:59（北京时间）核验公网 `/api/releases/latest` 为200、版本6.0.1，服务器缓存尚未同步6.0.2；本聊天未取得可用云控制台会话，未修改服务器。直接下载本版安装器可用。
