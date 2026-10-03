# 医栈通 V6.0.1 验证记录

2026-10-03。本版以已发行的 V6.0.0（`1ffa3f8`）为基础，保留工作台、项目管理、知识库、全局检索及数据 schema 6。仅发行 Windows x64。

## 文件与行为

检查 App 导航、主题变量、已有响应式规则、新闻图文组件、V6 工作台及发行流程。修改 `src/App.jsx`、`src/main.jsx`，新增 `src/themes/interface.css` 和 `scripts/interface-ui-test.mjs`；更新版本、README、CHANGELOG 和发行说明。设计原则与参考来源见 `INTERFACE-DESIGN.md`。

校园快讯与今日概览并列，导航行统一几何与选中状态。展开分类降低视觉权重，折叠分类仍显示当前页面归属；收起侧栏继续支持分组弹出菜单。减少新闻逐条浮动卡片、首页指标的大色块和顶栏装饰，统一项目与知识页面的边界。保持个人主题、背景和侧栏隐藏偏好。

## 命令与验证

- `npm test` / `node --test --test-reporter=dot tests/*.test.mjs`：156 项通过。
- `npm run build`、`npm run dist:installer`：成功，生成 7 份离线帮助与 Windows x64 安装器。
- `node scripts/interface-ui-test.mjs release-medstack-6.0.1/win-unpacked/Medstack.exe`：50 组检查通过。包括导航文字起点、行高及圆角一致，键盘激活、折叠当前位置、分组弹出菜单、隐藏偏好；8 主题 × 3 窗口尺寸 × 首页/快讯无横向溢出，1366×768 首页无需整页滚动。
- `node scripts/compact-ui-test.mjs release-medstack-6.0.1/win-unpacked/Medstack.exe`：66 组布局检查通过，含 62 条合成任务、8 主题、侧栏和补记。
- `node scripts/workhub-ui-test.mjs release-medstack-6.0.1/win-unpacked/Medstack.exe`：7 组操作通过。项目、关联任务和日程、知识记录、修订、全局搜索、备份恢复、重启保留与登出门禁可用。
- `node scripts/medstack-package-test.mjs release-medstack-6.0.1/win-unpacked/Medstack.exe`：实际发行程序 Pi 两步工具调用、用户核对后入库、密钥隔离通过。
- `node scripts/research-package-audit.mjs`：6302 个包内文本扫描无秘密模式命中，包内关键 V6 源文件与源端一致。
- 源码隐私扫描 355 文件无命中（添加本验证文档前）；改动文件 Prettier、`git diff --check` 通过。
- 实际程序合成截图复核了快讯、首页和 V6 项目页面，包含纸面、午夜、医疗和鎏金主题。完整布局截图在忽略目录 `test-results/interface/`；没有使用真实个人内容。

## 发行物与验收边界

安装器：`Medstack-Setup-6.0.1-x64.exe`，120638133 字节。SHA256：`2698ff5458809ebd7c2d543dedde8a90ab5b858548bf11fec087f54eaa9e81be`。

本机真实安装尚未替换，本轮没有写入真实个人数据。云端公告缓存同步尚待核验；当前会话没有可用的已登录腾讯云控制台。没有商业代码签名，未进行干净系统安装卸载。本版不扩展 V6 原有的科研数据同步边界。

GitHub Release `v6.0.1` 已发布，远端安装包字节数与 SHA256 digest 已由发行脚本核对一致；发行目录 `releases/stable.json` 仅含 Windows 下载。源码、设计准则与发行目录同步至 main。只读检查公网最新版本接口返回 HTTP 200 / 6.0.0，云缓存仍待更新；本机安装状态不据此视为更新完成。

开发使用独立隔离源码，不合入原主目录中并行的公众号二维码改动，不改 Android 或独立小程序。检查过程中生成的旧版本内部试包没有发布。
