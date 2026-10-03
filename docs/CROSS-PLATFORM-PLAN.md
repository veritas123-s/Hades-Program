# Medstack V6.1.0 验收范围

2026-10-03。用户要求系统性美化、安卓版和 macOS DMG。本轮恢复 Android 开发；保留「工作台」名称，不恢复送审登记。

1. 桌面：统一表单、按钮、对话框、焦点、滚动与减少动态效果；保留八款主题和自定义背景。检查所有主要页面的普通、窄窗口、深色及空状态；运行实际 Electron 流程并检查截图。
2. Android：重新构建当前正式 APK，保留原包名及发布证书；更新排版、导航、触摸控件和深色显示。检查登录隐私门、任务、日程、专注、Poseidon、同步与升级；模拟器验证不能替代用户真机验证。
3. macOS：Intel x64 与 Apple Silicon arm64 分别生成 DMG，最低 macOS 13（Electron 44 要求）。保留应用 ID 和旧数据目录；提供原生菜单、编辑快捷键、Dock 再打开与随包帮助。挂载 DMG、复制应用、核验签名、启动实际包并验证账号与工作台功能。
4. 发行：分别记录大小、SHA256、构建来源和实际运行证据；更新目录按平台及架构选择文件。没有 Apple Developer 凭据时只能提供 ad-hoc 签名，不宣称 Developer ID 签名或 Apple 公证。

2026-10-04 更新：桌面界面与四个平台安装包已完成本轮验证并公开发行，具体文件、CI 来源、界面证据及边界见 [V6.1.0 验证记录](VALIDATION-V6.1.0.md)。Android 真机升级 / 真实跨端同步、Apple Developer ID 公证和线上公告缓存同步仍未完成，不因模拟器与原生 runner 通过而推定这些事项完成。

平台依据：[GitHub runner 架构](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[electron-builder 26 macOS 签名](https://www.electron.build/v26/docs/features/code-signing/code-signing-mac/)。
