# 医栈通 V5.3.1 品牌补充

在 V5.3.0 课表、快讯与更新修复基础上，加入用户提供的 Medtrix 原始 PNG。桌面登录页和设置「关于」使用同一组件；Android 登录页使用同一原始文件。仅调整显示视口，未改绘标识；没有增加广告、遥测或远程图片请求。

修改 `AccountPage.jsx`、`SettingsPage.jsx`、`v5.2.css`、Android `MedstackApp.kt`；新增 `TeamBrand.jsx` 与两端本地品牌图片。同步桌面/Android 版本和手册标题。原应用图标、应用 ID、账号检查及数据路径保持兼容。功能验证与安全边界见 [V5.3.0 验证](VALIDATION-V5.3.0.md)。

`npm test`：148/148。最终实际 Windows 发行程序通过登录/关于品牌图片加载与截图核对、66 项布局检查及 12 组课表显示检查。发行隐私检查扫描 6287 个文本文件，无匹配的私密数据或旧品牌。Android CI 编译、检查成功，版本 531 / 5.3.1，既有签名身份验证通过；用户暂无手机，实机验证仍待完成。

两端安装包已发布至 [GitHub Release v5.3.1](https://github.com/veritas123-s/Medstack-Program/releases/tag/v5.3.1)。Windows SHA256：`29940cbc33b89c75eba7cebe20c92993796219fc90181152c7f1051a544b80b0`；Android SHA256：`22e86a2b0e9954e3d44e1220de2efd8306c062adea589abe9c38dc76d392b8d0`。远端资产哈希已验证。

用户托盘退出后，通过原生当前用户上下文重新核对物理数据目录、备份 59 个配置文件与旧程序，再运行实际 NSIS 安装器覆盖原安装目录。实际启动版本 5.3.1，根目录和账号空间各 10 条专注记录，原始区间、任务与加密配置保留；桌面与开始菜单入口核验一致。验证进程关闭后正常重新打开应用。未修改独立微信小程序工程或其他云服务。

一键更新下载/校验及独立安装脚本的成功、失败恢复已隔离验证；本次真实安装器升级也已通过。完整的客户端一键更新至未来版本仍需下次发行时验收。

发布后用户明确要求停止 Android 开发与支持：安卓源码/APK 保留历史归档，GitHub 的 android.yml 与 android-smoke.yml 均核验为 disabled_manually；源工作流移除自动触发并固定跳过。发行脚本只上传/核验 Windows，新 stable 目录仅包含 Windows 下载。版本一致性测试改为检查当前支持的桌面范围，148 项再次通过。未撤销用户账号或删除历史安卓文件。

现有服务器仅同步公开发行目录，执行 `inv-u9dvbqgn7w` 成功，日志核验 releaseVersion 5.3.1 与匿名偏好 401。公网 HTTPS 最新版本接口 200，返回目录与仓库 stable 内容一致，仅含 windows。没有新增后台权限、资源或主动群发邮件；其他同机服务未变更。

共享 DECISIONS、coding-projects、HANDOFF 已在备份后记录 Windows 单平台支持及本轮安装事实，CHANGELOG 已追加。没有修改 Codex Memories。
