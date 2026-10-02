# 医栈通 V5.3.0 验证记录

本版修改 Windows 课表、校园快讯采集与图片、编码解析、侧栏直接入口及更新服务。Android 同步版本号，保留原有账号与 Pi 能力。没有修改个人任务、专注区间或数据目录标识。

## 检查范围

读取并修改 `CalendarPage.jsx`、`v5.2.css`、`App.jsx`、`NewsCover.jsx`、`UpdateCenter.jsx`、`main.cjs`、`news-service.mjs`、`news-images.mjs`、`news-text.mjs`、`updates.mjs`。新增 `news-markup.mjs`、`public-fetch.mjs`、`image-dimensions.mjs`、`update-installer.mjs`。同步桌面/Android 版本、发行说明、使用与开发手册。

## 已完成的验证

- `npm test`：148 项通过；包括原文日期/标题变化保留删除墓碑、错误编码声明、空封面、嵌套正文、停滞响应、恶意跳转与巨大图片。
- `npm run test:security`：14/14，隔离合成账号后台；没有向生产服务发送攻防请求。
- `node scripts/calendar-readable-ui-test.mjs`：四种窗口宽度和年/月/日共 12 组；嵌入月课表有课程名与时间，年视图有课程数量。
- `node scripts/compact-ui-test.mjs`：66 组布局，八款主题与 62 项合成任务；常用桌面尺寸主要页面无需整页滚动。
- `node scripts/news-visual-ui-test.mjs`：真实主进程缩略图、无图回退、图文自适应、搜索、删除与恢复通过。
- `node scripts/update-install-ui-test.mjs`：实际发行程序展示一键更新；错误哈希阻止安装和退出，当前账号仍可使用。
- `node scripts/update-worker-test.mjs`：Windows 独立安装脚本在含空格路径中运行；合成安装器成功与失败两种情况，业务文件与备份一致，失败恢复旧程序。为避免改动测试人员的安装注册表，本项没有运行真实 NSIS 安装器。
- 官方公开网页解析探查：交大列表 12 条，医学院首页 47 个官方原文入口含 8 个微信链接；两个医学院文章的日期与封面可解析。只证明当次页面解析，不能证明公众号全量覆盖。

## 发行与安装状态

两端安装包已发布至 GitHub Release v5.3.0，远端资产哈希已核验。Windows 安装包 SHA256 为 `4595e138d95c1061add8eb4ea3379e71a6da5b3cb4547c932e1060983c734007`；Android 为 `62a3473f1271173663a1401a2cc3832607baef67ba129c567e22f70282c0b0d6`，使用既有发行身份签名。实际最终发行程序的图文与一键更新界面检查再次通过。本机完成停止旧程序及真实数据备份；用户随后追加 Medtrix 品牌标识，将由 V5.3.1 合并安装，未安装 V5.3.0。

## 边界

公开索引可能延迟、遗漏或出现验证码；不绕过验证，也不把失败当作无消息。无法恢复的损坏原文不会凭空补成中文；保留原缓存和文字回退。Windows 尚未配置发行代码签名。一键更新只有安装本版后才能用于后续版本；需要 Windows、可用网络、足够空间和安装目录写入权限。Android 实机同步验收仍待手机测试。隔离攻防并非正式安全审计，不承诺不存在隐私风险。

共享项目记录建议在发行与本机升级核对完成后更新。
