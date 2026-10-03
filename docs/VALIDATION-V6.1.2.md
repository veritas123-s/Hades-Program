# 医栈通 V6.1.2 验证记录

日期：2026-10-04。基于 V6.1.1，仅调整团队标志的背景和显示。医栈通主标志 `BrandMark.jsx`、桌面图标、Android `medstack_icon.xml` 和应用名称保持原样。

## 文件与检查

检查 `TeamBrand.jsx`、主题样式、登录入口、设置关于页、Android 登录页、版本与打包配置、公告脚本和现有验证脚本。新增 `medtrix-wordmark-transparent.png`，采用内置 imagegen 对原 `medtrix-brand.png` 去白底；原文件保留。PNG 为2172×724，角落及透明间隔 alpha=0。提示词和来源见 `MEDTRIX-BRANDING.md`。

修改 TeamBrand、v5.2.css、Android 团队署名图片、两端版本与发行说明；新增透明图片、品牌渲染脚本与本记录。

- `npm test`：163项通过。
- `npm run build`、`npm run dist:installer`：Windows 构建成功。
- `node scripts/brand-preview.mjs`：源码和实际打包程序均生成7张合成账号截图，覆盖登录页、纸间/午夜/医疗主题、1400与720宽度以及窄窗口150%缩放；登录页截图已检查。
- Android 编译及 lint：37146129032 成功；发行 APK 模拟器启动、登录门禁、深色和130%字号：37146420129 成功。原发布证书一致，私钥仅本机使用。
- Mac x64和arm64原生验证：37146130910 成功。挂载DMG、复制至Applications、深度签名、登录门禁、原生菜单、离线帮助、Dock再打开、匹配架构更新、关于页和工作台操作通过；arm64关于页截图已检查。
- `git diff --check`通过。公开发行包104个主进程/渲染文本扫描通过，主标志引用及应用图标保持原样。

构建源提交 `1eb808e06a105c594c09f876c8dc66c23b61a8b2`，规则测试与CI均基于此生产代码。

## 附件摘要

| 平台 | 字节 | SHA256 |
|---|---:|---|
| Windows x64 |120887457|c6a8fe450692d9f362fd62f4752c0c9f303ab15e19e4fced1730b9c238445b88|
| Android |2936459|273d8e0becdd153ca8981aac1db42410dce18d3ef8d70d619fde1e82155d3179|
| macOS Intel |148171532|9fe6398e19d1452122180125913f64cda3b108227c7ef52e982d8de8cd58c405|
| macOS Apple芯片 |142654930|19c70742d74e440efb58ac4e49744e43c385bee926b08db415195ced380517b1|

Mac 仍为 ad-hoc 签名，无 Developer ID 或公证。本机个人安装、真实学校会话及手机真机未替换或验收。此版本保持旧功能边界；移动端完整桌面功能对齐、扩展课表、工作文件夹和服务器公众号采集仍属于其他开发任务。
