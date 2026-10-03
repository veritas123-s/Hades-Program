# 交大邮箱 IMAP 桌面测试版

2026-10-04。基于已发行 V6.1.1 的独立功能分支 `codex/sjtu-imap`。本功能尚未合入正式发行，不改变公开 stable 目录、线上服务和已安装程序。

## 使用

登录医栈通后，在“教务信息 → 交大邮箱”输入 jAccount 用户名（也接受 @sjtu.edu.cn 地址）及邮箱密码。密码仅驻当前进程；不会写入配置、备份、云同步或模型上下文。断开、退出账号、认证失效和退出程序清空会话。重新打开程序需要重新连接邮箱。

支持收件箱最近 200 封、邮箱总体未读计数、范围内未读筛选、主题/发件人搜索、纯文本正文、附件名称及显式“转为待办”。转为待办只保存主题、发件人、邮件日期及邮箱来源标识，不保存正文；重复点击不重复创建。创建的任务按原任务功能保存、同步和使用。不会将邮件正文交给 Poseidon。

只读访问，不改变已读状态；不发送、删除、移动邮件。附件内容不提供下载，单封原始邮件超过 10 MB 提示转到网页邮箱。HTML 转为纯文本，不加载外部图片或执行邮件脚本。总未读数可包含最近 200 封以外邮件，界面明确标出筛选范围。

服务固定为 `mail.sjtu.edu.cn:993`，TLS 验证证书，最低 TLS 1.2。只允许学校邮箱账号，不提供任意服务器连接。参考[交大网络信息中心](https://net.sjtu.edu.cn/wlfw/dzyj.htm)、[ImapFlow](https://github.com/postalsys/imapflow)、[MailParser](https://nodemailer.com/extras/mailparser)。依赖实际安装锁定 imapflow 2.2.2、mailparser 3.9.33，原许可保留在包内依赖中。

## 验证记录

- `npm test`：172 项通过，其中 9 项为邮箱验证。真实 ImapFlow 连接本地合成 IMAP 服务，捕获 EXAMINE 与 BODY.PEEK，未发送 STORE、SELECT、APPEND、EXPUNGE、COPY、MOVE 或 DELETE。
- 检查用户名、主进程账号门禁、TLS 配置、中文 MIME、协议错误脱敏、账号切换/退出时丢弃迟到结果、UIDVALIDITY 改变、超大及不完整邮件、重复转待办。
- `npm run build`：通过。
- `node scripts/mail-ui-test.mjs <Electron路径> --source` 及 `node scripts/mail-ui-test.mjs release-imap-preview/win-unpacked/Medstack.exe`：源端及实际 Windows 包各 7 组检查通过，包括连接、筛选搜索、HTML 纯文本、任务去重、密码不进快照、1400×900/820×650、断开和退出门禁。截图已人工查看。使用完全合成账号和邮件，不连接真实邮箱。
- 官方服务器仅 TLS 握手实测通过，TLSv1.3、证书验证通过；没有提交真实账号密码。
- `npm audit --omit=dev`：生产依赖报告 0 项漏洞；完整依赖报告 8 项开发链高等级告警，本功能未执行破坏性自动修复。该审计结果不等同于全面安全保证。
- 实际包内 6876 个文本文件秘密模式扫描无命中；扫描覆盖私钥、GitHub 令牌及云密钥典型格式，不等同于全面安全审查。包内邮箱服务与最终源码经格式归一化比较一致。
- 构建目录为忽略的 `release-imap-preview`；测试隔离数据和截图保存在临时目录/忽略的 `test-results`。未更改真实个人数据、安装、数据库或云端公告。

## 文件与边界

检查过仓库 AGENTS.md、README、package.json、账号门禁/生命周期、命令路由、任务输入、模块注册、侧栏导航与既有 Electron 测试框架；同时核对共享项目记录及历史 IMAP 只读验证。

新增 `electron/mail-service.mjs`、`electron/commands/mail.mjs`、`src/modules/mail/`、邮箱规则/协议/界面测试及本说明；修改主进程生命周期、命令注册、侧栏分类和两项依赖。保留其他目录正在开发的文件中心、顶部栏、Android、二维码及微信小程序改动。

真实交大账号登录、真实复杂邮件与附件、多主题长邮件以及 macOS 原生运行仍待验证；Android/微信小程序本轮没有邮箱入口。测试程序延续 V6.1.1 基线版本，不视为新的正式发行。下一轮正式版本可合入本分支，再完成目标平台发行验证。

## Windows 测试包

交付 `release-imap-preview/Medstack-IMAP-Windows-test.zip`，解压后运行 `win-unpacked/Medstack.exe`。先退出原医栈通及托盘实例；程序沿用原账号及数据目录，本轮没有自动安装或迁移个人数据。

ZIP 的 SHA256 为 `de34cbf9862deaae3572416e0707ead3e5e128a1b893848df7175ed77451a719`。内部 app.asar 与通过上述实际 UI 检查的目录一致，包含两项新增依赖的原始许可与邮箱说明。该 ZIP 内说明取自哈希生成前的版本，不包含此哈希段落。

另外生成了便携 EXE，但自动化工具无法完成对外层便携启动器的连接，该尝试已停止并关闭仅属于测试的隔离进程。对外交付采用已完成界面检查的程序目录 ZIP，不将便携启动器尝试记为通过。
