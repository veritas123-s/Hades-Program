# 公众号后台二维码入口试验

2026-10-03，源码试验，尚未发行或替换本机安装。

用户要求后台识别公众号二维码，用户界面只显示内容。二维码图片解码、入口请求和回退已接入桌面主进程；界面保留内容、刷新、组织关注、删除恢复和简短更新状态，移除采集过程、详细采集诊断及文章导入表单。既有 `news.import`、`news.configure` 接口和个人缓存兼容保留。

## 实网结论

仅确认一个真实二维码：医学院官网首页标注“扫一扫关注微信公众号”的 `https://www.shsmu.edu.cn/images/weixin.jpg`。Windows Electron 的 nativeImage 和独立 jsQR 解码线程成功识别入口；HTTPS 请求返回客户端下载跳转脚本，没有文章列表。没有执行脚本、启动微信客户端或取得微信会话。

因此，已验证“后台识别二维码和检查入口”，尚未实现“通过二维码取得该公众号完整文章列表”。其他 11 个默认公众号尚无核验过的二维码，仍走原公开来源路径。不要将本次试验描述为公众号全量抓取成功。

## 实现范围

- `electron/news-qr.mjs`：后台二维码目录、图片/入口校验、原生像素转换、限时解码和公开文章候选检查。
- `electron/news-qr-worker.mjs`：jsQR 识别，独立线程及超时终止，避免阻塞界面。
- `electron/news-service.mjs`：先检查已配置二维码；无法读取时回退原公开索引；原文按公众号名称核验，保留缓存和删除墓碑。客户端下载入口结果缓存 24 小时，其他结果缓存 5 分钟；退出账号清空内存缓存并丢弃迟到结果。
- `src/modules/news/NewsPage.jsx`：内容与刷新界面，不显示后台扫码及采集步骤。失败保留“部分来源暂未更新”提示，不将失败描述为没有新文章。
- `tests/news-qr.test.mjs`：9 项二维码入口、回退、来源、账号和缓存测试。
- `scripts/wechat-qr-live-test.mjs` / `scripts/wechat-qr-probe.cjs`：真实 Windows Electron 无窗口公开网络检查。
- `scripts/news-visual-ui-test.mjs`：扩展界面检查，确认隐藏处理步骤，保留封面、搜索、删除恢复和三个窗口尺寸验证。
- `package.json` / `package-lock.json`：新增固定版本 `jsqr@1.4.0`，纯 JavaScript、无新增传递依赖，Apache-2.0。

二维码目录只有来源核验过的图片；未来补充其他公众号时添加到 `WECHAT_QR_ENTRIES`，同时核验来源归属。无需新增前端扫码按钮。这里的图片识别不产生微信身份认证，也不会授予后台读取公众号历史消息的权限。

## 验证命令与结果

在项目目录执行：

```powershell
node --test tests/news-qr.test.mjs tests/news.test.mjs tests/public-news-security.test.mjs tests/news-images.test.mjs
npm.cmd test
npm.cmd run build
node scripts/wechat-qr-live-test.mjs
node scripts/news-visual-ui-test.mjs
npm.cmd audit --omit=dev
```

相关 24 项测试通过；全量 157 项测试通过；生产构建通过；真实入口结果 `client-required`、文章链接 0 条；Electron 界面检查通过并检查截图。生产依赖审计 0 项漏洞；完整安装时提示的 8 项高危属于开发依赖，本次未进行无关依赖升级。

详细诊断仅写入忽略的 `test-results/`；源码试验没有访问个人账号、部署服务、发送微信消息或更新本机应用。暂不推荐将其记录为已上线能力；如需更新共享项目记录，应明确标注二维码入口试验与文章列表未取得。

参考：[jsQR 官方说明](https://github.com/cozmo/jsQR)、[Electron nativeImage 官方说明](https://www.electronjs.org/docs/latest/api/native-image)、[二维码公开来源](https://www.shsmu.edu.cn/)。
