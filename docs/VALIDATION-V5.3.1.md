# 医栈通 V5.3.1 品牌补充

在 V5.3.0 课表、快讯与更新修复基础上，加入用户提供的 Medtrix 原始 PNG。桌面登录页和设置「关于」使用同一组件；Android 登录页使用同一原始文件。仅调整显示视口，未改绘标识；没有增加广告、遥测或远程图片请求。

修改 `AccountPage.jsx`、`SettingsPage.jsx`、`v5.2.css`、Android `MedstackApp.kt`；新增 `TeamBrand.jsx` 与两端本地品牌图片。同步桌面/Android 版本和手册标题。原应用图标、应用 ID、账号检查及数据路径保持兼容。功能验证与安全边界见 [V5.3.0 验证](VALIDATION-V5.3.0.md)。

`npm test`：148/148。最终发行包的品牌显示、基本布局与本机升级核对结果在完成后补充。
