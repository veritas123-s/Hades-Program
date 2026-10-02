# 来源与迁移边界

上游：https://github.com/tototwoto/MySHSMU ，拉取基线 73fed4f（2026-03-21）。原 Android 源码完整保留在父目录，未修改。

桌面版参考上游 ShsmuService.kt、CurriculumUtils.kt、MainViewModel.kt 的校园接口、字段映射与课表逻辑，重写平台适配。复用用户此前本地 shsmu-timetable 项目的 calendar.mjs 日期计算、响应校验设计及学校域名校验方式。

已安装的 MySHSMU Desktop 0.1.1 只定位到 Windows 二进制，未找到该版源码；未提取其登录凭据或复制私有数据。新版使用独立应用 ID 和数据目录。

V1 使用学校网页手动登录。V1.1 参考上游 PersistentCookieJar 与 MainViewModel 的会话恢复、失效后续登流程，使用 Windows safeStorage 加密 cookie 与可选账号密码；不沿用原版明文 SharedPreferences，不移植验证码识别。学校页面负责密码加密与表单认证。课表、成绩、课程详情、教室接口需本人完成学校登录后进行实网验收。

当前上游仓库未发现 LICENSE 文件。保留来源，不将其标注为 MIT 等已授权协议；分享测试版不代表已取得上游的公开发行授权，公开发布前应确认上游授权。

V1.3.1 的腾讯云浏览器授权流程参考 TencentCloud/tencentcloud-cli 的 tccli/plugins/auth/login.py、browser_flow.py 和 tccli/oauth.py，使用其公开 CLI 授权入口。本项目改写为 Electron 主进程实现：仅监听本机回调、先验证随机 state、保留 TLS 校验、限制响应大小、增加超时与取消、临时凭据只保存在内存，不写入 TCCLI 配置文件。上游采用 Apache-2.0，完整许可随安装包附于 licenses/TENCENT-CLI-LICENSE.txt。此应用为独立项目，不代表腾讯云官方产品。

独立云端提醒仅携带本项目通用 Python 程序，不携带原作者邮件统计、个人备忘、阅读计划、账号、接收 Token 或历史快照。

Medstack V2.0 保留 AI·VERITAS 的应用 ID、数据目录与加密上下文。学习通连接器独立编写；协议字段参考超星官方登录页面、Zhanghuaimin-233/chaoxing-homework-checker 的 API.md 与 DanMo661/Xuexitong-mcp 的接口说明（2026-09-27查阅）。未复制上述项目程序代码。页面变化可能导致连接失效，真实账号需本人扫码验证；不包含自动答题或提交。
参考： https://i.chaoxing.com/ 、https://github.com/Zhanghuaimin-233/chaoxing-homework-checker/blob/main/API.md 、https://github.com/DanMo661/Xuexitong-mcp
