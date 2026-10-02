# Medstack Android V5.0

安卓端是 Medstack 的原生 Compose 伴侣应用。它使用与电脑端相同的 Medstack 账号和同步文档，提供今日概览、任务编辑、课程与日程查看、专注记录及同步冲突处理。手机和电脑之间没有局域网监听或文件共享。

## 构建

需要 JDK 17、Android SDK 36 和已接受的 Android SDK 许可：

```powershell
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

仓库的 Android 工作流在 GitHub 托管环境中执行同样的编译和 Lint，并输出可安装的调试 APK。正式分发包需要长期保管的独立签名密钥：在 `android/keystore.properties` 中提供 `storeFile`、`storePassword`、`keyAlias`、`keyPassword` 后执行 `:app:assembleRelease`。该文件和密钥文件均被 Git 忽略。

## 数据与安全

- 固定连接打包的 HTTPS 账号地址，不接受用户输入的任意服务地址或跳转。
- 会话令牌和离线文档使用 Android KeyStore AES-GCM 加密。
- 禁用明文网络、云备份和设备迁移备份。
- 云端写入携带版本号，冲突时必须明确选择云端或手机版本。
- 学校登录会话、模型 API 密钥和云厂商凭据不进入安卓同步文档。

默认云文档位于 `app/src/main/assets/default-cloud-document.json`。桌面同步字段发生兼容性修改时，须从根项目的 `cloudDocument(initialState())` 重新生成并同时运行根项目、服务端与安卓构建检查。
