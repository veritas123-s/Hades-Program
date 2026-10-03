# 医栈通 V6.1.0 验证记录

2026-10-04。目标为统一界面、恢复 Android 和制作 Intel / Apple Silicon macOS DMG。「工作台」名称保留，送审登记未恢复。全部操作验证使用隔离合成数据；本机真实安装与个人资料未修改。

## 实施与检查文件

检查了仓库 AGENTS、共享项目决定、README、桌面入口与账号门禁、主题与界面组件、更新目录、Android Compose 页面和签名配置、macOS 打包与帮助文档规则，以及原有测试与发行流程。原目录的二维码及小程序改动没有合入或覆盖。

修改包括 `src/themes/interface.css`、桌面菜单与快捷键、`electron/help.mjs`、更新平台选择、Android 主题 / 导航 / 安全区域 / 系统栏、打包配置与使用说明。新增原生 Mac 包运行检查、Android 单独测试 APK 与截图导出、双架构 Mac 和 Android 工作流。发行脚本要求四个平台附件齐全并逐一核对远端大小和 SHA256 后才公布版本。

## 桌面验证

- 163 项规则测试通过，桌面构建成功。覆盖账号隔离、同步冲突、可恢复删除、工作台领域模型、助手权限及严格发行目录。
- 实际 Windows 程序通过 290 项界面检查：12 页 × 8 主题 × 3 种尺寸及导航位置 / 键盘检查。无横向溢出；截图采用合成课程与任务。
- 工作台 7 组操作验证通过：项目与里程碑、关联任务 / 日程、知识修订与恢复、搜索 / 软删除、主题 / 布局、备份与恢复、重启保存及登出门禁。
- Pi 助手实际两步工具循环、授权知识查询、草稿确认及密钥隐藏通过。最终包源码与许可核对一致；6306 项包内文本扫描无命中。

Mac 分别在原生 Intel 和 Apple Silicon runner 上构建。DMG 挂载与校验、Applications 链接、复制后框架链接、deep strict 签名、最低系统版本 13、实际架构、启动登录门禁、原生菜单、离线帮助、登录后界面、关窗后 Dock 再打开及对应架构更新选择均有运行验证。工作台 7 组操作另在两个安装后的实际 Mac 应用执行。

## Android 验证

包名 `com.medstack.app`，版本 6.1.0 / 610，最低 Android 9；正式 APK 保留原发布证书。证书 SHA256 为 `7eb67fe3f6360bf064840a3bb222df98ab8f00696b0f0c8f7575ac67913059a3`，本机签名及 apksigner 验证通过，私钥未上传。

release 构建及 lint 通过；lint 仍有 21 项警告，不声称零警告。API35 模拟器检查发布 APK 的登录门禁、品牌、无启动崩溃、系统深色模式、130% 字号及登录表单滚动。

单独测试 APK 通过界面创建 / 完成 / 软删除任务、查看合成日程、开始并保存专注、进入 Poseidon 和账号设置；检查加密缓存、账号隔离、退出后的隐私门禁与保留缓存。实际 JUnit 报告为 1 个端到端测试、0 失败 / 错误 / 跳过；七张界面截图已导出，人工查看了任务、日程、专注、助手、设置和深色放大字体截图。合成状态通过测试 APK 注入，生产应用不含免登录入口。没有安装令牌，因此操作测试不向生产后台发起鉴权请求。正式 APK 内 87 项文件检查未含测试账号类、签名私钥或非空个人默认记录。

## 执行命令

```text
npm test
npm run build
npm run dist:installer
node scripts/interface-ui-test.mjs release-medstack-6.1.0/win-unpacked/Medstack.exe
node scripts/workhub-ui-test.mjs release-medstack-6.1.0/win-unpacked/Medstack.exe
node scripts/medstack-package-test.mjs release-medstack-6.1.0/win-unpacked/Medstack.exe
node scripts/update-package-audit.mjs
node scripts/research-package-audit.mjs
node local-ops/source-privacy.mjs
node --test server/test/releases.test.mjs
npm ci --ignore-scripts && npm run build:mobile-agent
./gradlew --no-daemon :app:assembleRelease :app:lintRelease
bash scripts/android-package-smoke.sh
bash scripts/android-workspace-smoke.sh
npx electron-builder --mac dmg --x64 --publish never
npx electron-builder --mac dmg --arm64 --publish never
node scripts/macos-package-smoke.mjs
node scripts/workhub-ui-test.mjs <安装后的Mac可执行文件>
git diff --check
node scripts/publish-release.mjs releases/notes-6.1.0.json --publish
```

源码隐私检查使用原工程中忽略的 `local-ops/source-privacy.mjs`，通过绝对路径调用；它不是本分支的公开源文件。Mac / Android 命令在对应平台的 CI 环境执行，未在 Windows 假称执行。

## 验证边界

Mac 为 ad-hoc 签名，未取得 Apple Developer ID 签名和公证；系统首次打开可能拦截，见使用说明及 [Apple 官方说明](https://support.apple.com/en-ie/102445)。Windows 未购买代码签名证书。

未在用户个人安装目录执行真实升级、未在用户 Android 真机执行覆盖升级和真实跨端账号同步。相同 Android 包名与证书经过核验，不能替代真实设备升级测试。项目和知识库保留桌面账号本机存储的现有边界，不自动同步到 Android。系统栏按 [Android 官方 edge-to-edge 接口](https://developer.android.com/develop/ui/views/layout/edge-to-edge) 跟随系统主题。

线上账号服务的公告缓存需单独读回确认；当前聊天没有可用的已登录腾讯云控制台，不能把 GitHub 发行目录更新称为线上缓存已更新。未群发更新邮件或新增云资源。

## 发行文件和 CI 证据

| 文件 | 字节数 | SHA256 |
| --- | ---: | --- |
| Medstack-Setup-6.1.0-x64.exe | 120645950 | `0d2cc6f9fcfd464f9b496c4c4640428d39af36b9fec684d76ca1bb8209b04406` |
| Medstack-6.1.0-Android.apk | 3157643 | `fd6ee7c8680796a72a5f999ada13d64fa6237c03449a6f01132c426b1005fc81` |
| Medstack-6.1.0-macOS-x64.dmg | 147894810 | `e48026c578d8442751b910cc07db7a99ac44913b3221a9f9d8086845176924c5` |
| Medstack-6.1.0-macOS-arm64.dmg | 142428244 | `5aa293cad039f2d9b9bc752698b55d84d580284747459abf88772f0107cd7cb2` |

Windows 最终包在 `998a743` 的桌面及文档内容上本机构建；Mac 使用同一提交的 [双架构原生验收 37135852452](https://github.com/veritas123-s/Medstack-Program/actions/runs/37135852452)。Android 正式 APK 来自 `2e87a45` 的 [release / lint 构建 37136072698](https://github.com/veritas123-s/Medstack-Program/actions/runs/37136072698)，在本机用原证书签名。

[安卓最终界面功能验证 37136364474](https://github.com/veritas123-s/Medstack-Program/actions/runs/37136364474) 和 [正式 APK 模拟器验证 37136369498](https://github.com/veritas123-s/Medstack-Program/actions/runs/37136369498) 均成功。后续 `b1b0b39` 仅修正测试截图保留；与以上构建相比，所发行的各平台生产代码和随包文档没有后续改动。

GitHub 源码 main 已快进至 `b1b0b39`，后续提交仅补充版本目录与最终验证记录。[V6.1.0 公开发行](https://github.com/veritas123-s/Medstack-Program/releases/tag/v6.1.0)包含上述四个附件，发布脚本已逐一核对 GitHub 附件大小与 SHA256，全部一致后才取消草稿状态。`releases/stable.json` 包含四个平台及相同哈希；本机同时生成 `SHA256SUMS.txt`。

源码扫描 378 项无命中（最终文档提交前），正式 APK 文件检查及 Windows 打包文本扫描无命中；扫描不能证明绝对安全。线上公告缓存未同步；本轮公网健康与公告请求未成功完成，不能据此判定后台状态。当前浏览器清单无腾讯云控制台会话，因此未假称已经部署缓存或发送版本通知。
