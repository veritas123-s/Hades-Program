# 医栈通 V6.1.1 验证记录

日期：2026-10-04。基于已发布 V6.1.0 的跨平台版本，按用户最新要求整理关于页和说明。四个平台已公开发行并校验，线上缓存已同步。

## 文件与来源核验

阅读设置页、校园连接器、学校认证、校园命令、日期与课表模型、Android 工程、来源说明、用户与开发手册、打包配置、公告处理和相关测试。对照本地参考仓库基线 73fed4f 的 ShsmuService.kt、CurriculumUtils.kt、PersistentCookieJar.kt 与 MainViewModel.kt：未发现直接复制的代码文件或代码块，桌面连接器使用本项目 JavaScript，移动伴侣没有参考项目的 Kotlin 类、资源或依赖。学校接口地址、参数和字段曾参考该仓库；这是有范围的源码核对，不声称完全未借鉴，也不作法律判断。技术来源继续留在 ORIGIN，产品关于页不再显示该名称或致敬。

修改 SettingsPage、用户/开发说明、ORIGIN、README、根版本和锁文件、Android 版本、安装说明、发行说明及对应界面检查。SJTU Agent 的实际改写代码及完整 MIT 声明保持原样，其他产品与个人数据不改。

## 已执行检查

- `npm test`：163 项通过。
- `npm run build`、`npm run dist:installer`：通过。
- `node scripts/news-visual-ui-test.mjs release-medstack-6.1.1/win-unpacked/Medstack.exe`：实际包图文、响应式、删除恢复、联系方式复制及关于页无旧名称通过。截图 `test-results/about-v522.png` 已查看。
- `node scripts/update-package-audit.mjs`：实际程序代码与源码一致，原 MIT 许可及署名保留。
- `node scripts/research-package-audit.mjs`：6306 项包内文本检查，无隐私发现。
- `node scripts/medstack-package-test.mjs release-medstack-6.1.1/win-unpacked/Medstack.exe`：Pi 实际工具循环、确认后入库、密钥隔离通过。
- 原本机 `local-ops/source-privacy.mjs`：最终含验证记录的 380 个源码文件，无发现。
- `node --test server/test/releases.test.mjs`：订阅、用户隔离、取消、退订、重启去重通过。
- Android 构建及 lint：37138089914 成功；模拟器功能：37138089927 成功；正式 APK 模拟器启动：37138405501 成功。均基于 a0c0cde；Android 生产代码与 V6.1.0 相同，仅版本 611/6.1.1。原证书签名验证通过。

Mac 原生 x64/arm64 运行 37138444767 成功，基于 edea27f：DMG 挂载、Applications 拖入后的深度签名、实际启动、登录门禁、原生菜单、离线帮助、Dock 再打开、对应芯片更新、关于页均通过；两种架构各完成 7 组实际工作台操作。两张关于页截图已查看。首次新增关于页检查被首启教程挡住，已修正测试脚本，生产程序未变。

Android lint 为 21 条警告、0 错误，未宣称零警告；功能报告 1 项端到端用例、0 失败/错误/跳过，正式包启动及深色大字体检查通过。Windows 包和 Android 生产构建来自 a0c0cde；Mac 来自 edea27f，仅多了测试脚本修正。33a8de6 只调整发行文案。

| 附件 | 字节数 | SHA256 |
|---|---:|---|
| Medstack-Setup-6.1.1-x64.exe | 120646416 | 7fea4d9c62e768eca98cf9d072180a08aa4ecd80e0d8540d1deaafcd3e62d919 |
| Medstack-6.1.1-Android.apk | 3157643 | 74a44accf8332b79cc325713d63fb8bcdbf3ffd8a7307e7f272cf00d254e7c69 |
| Medstack-6.1.1-macOS-x64.dmg | 147894570 | e1a4bffef3ed85d8bdf82e029254fbe687c17e936e38b9a84cf9b17062c8f6b8 |
| Medstack-6.1.1-macOS-arm64.dmg | 142428035 | 82e5637a4182970ae68d22b80d29931dc1f43629bfe18dc7492ea34208daf524 |

Android 原发布证书 SHA256：7eb67fe3f6360bf064840a3bb222df98ab8f00696b0f0c8f7575ac67913059a3。

## 线上公告检查

腾讯云已登录，实例通过公网地址及原计划任务确认。只读操作 inv-u9f628gi58 成功：服务 5.1.0 健康、匿名偏好 401、公网 HTTPS 200。旧缓存 6.0.0；远端公告已读取 6.1.0，但旧验证器只返回 Windows/Android。仅更新公告校验和邮件平台标签，保留账号、凭据、任务身份及其他服务。

首次更新在源码 SHA256 校验阶段停止，未替换服务文件；原因是本地 CRLF 与 GitHub LF 不同，已改用对应 Git 提交内容的哈希。第二次因健康接口先于公告首次加载完成，公告暂为空，检查触发回退；原源码已恢复。最终改为同时预置已校验缓存并等待读回，结果如下。

最终操作 inv-w9f6mcg8xx 成功、退出码 0：备份源码与数据库，仅更新 src/releases.mjs、server/releases.mjs 和 data/releases/stable.json；沿用原 Hades-Accounts 任务并恢复运行。公告固定读取已推送 f4bc6e5 的内容，SHA256 ae2b97fdf4b0389775575a7a5bc9c28c0e65b82ddde5893636a1a567e0a453d3。服务本机与公网 HTTPS 读回均与缓存深度比较一致，版本 6.1.1，四个平台齐全，公网 200，匿名偏好 401。未改变账号配置、业务数据库结构、订阅状态或其他服务。截图 test-results/cloud-v611-announcement.png 已查看。备份与失败回退文件保留，不删除。

## 公开发行

[V6.1.1](https://github.com/veritas123-s/Medstack-Program/releases/tag/v6.1.1) 含上述四个附件。发布命令 `node scripts/publish-release.mjs releases/notes-6.1.1.json --publish` 已核对远端附件大小与摘要后公开；`node test-results/verify-public-release.mjs` 再次通过公开仓库、非草稿、四附件、main/stable 与本地哈希的一致性检查。发行时源码 main 为 33a8de6，stable 提交 f4bc6e5；后续提交仅补充 README 与验证记录。源扫描与 `git diff --check` 已执行，真实本机安装仍未替换。

## 边界

没有替换本机真实安装、导入真实账号或运行学校真实会话。Mac 仍为 ad-hoc 签名，无 Developer ID 或公证；真机与 macOS13 实际系统验收边界沿用 V6.1.0 记录。项目与知识仍仅保存在桌面账号本机，不新增云同步。
