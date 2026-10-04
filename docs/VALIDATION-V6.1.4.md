# 医栈通 V6.1.4 验证记录

2026-10-04。移除校园快讯的订阅关键词输入、设置与排序匹配，旧值归一化时丢弃，不再影响“我的订阅”。保留主题订阅、屏蔽设置、消息搜索、既有删除记录和服务器倒计时。示例统一使用通用校园内容。

检查和修改 `src/modules/news/NewsPreferences.jsx`、`src/news-preferences.mjs`、既有规则与界面验证脚本、版本号和 macOS CI。公开166项规则、生产构建、源码程序订阅/屏蔽/重启/旧设置兼容/删除保留/宽度布局实测通过。私有工程与并行跨平台目录同步了上述四个已核对无冲突文件及示例规范，其他并行内容未覆盖。

Windows实际发行程序的主题订阅、屏蔽、旧值丢弃、重启持久化、重置、删除保留及三种宽度检查通过；打包源码与当前偏好模块一致。当前源码、生产界面和内置文档368个文本文件未发现个人课题示例；公开Windows包139个产品文本文件及独立私有包142个产品文本文件检查无命中。私有包也通过同一实际程序界面检查，仅本机保留，不进入公开发行。

生产源码提交 `f38a834973f96088f11320e5f31f22f90bfe855a`。原生macOS双架构任务[37171907187](https://github.com/veritas123-s/Medstack-Program/actions/runs/37171907187)完成DMG挂载、签名检查和实际程序启动、工作台、共享快讯与订阅界面验证；两个架构均确认关键词订阅输入不存在、旧值不写回。Android编译与lint[37171908922](https://github.com/veritas123-s/Medstack-Program/actions/runs/37171908922)通过，APK启动[37172202383](https://github.com/veritas123-s/Medstack-Program/actions/runs/37172202383)验证登录门禁、品牌、深色外观及130%字号。启动检查使用同一未签名产物的临时模拟器签名副本；公开APK在本机沿用原发布证书签名并验证，SHA256指纹为 `7eb67fe3f6360bf064840a3bb222df98ab8f00696b0f0c8f7575ac67913059a3`。没有重复声称本轮完成手机全部桌面功能对齐。

执行 `npm test`、`npm run build`、`node scripts/news-preferences-ui-test.mjs`及传入实际Windows/私有程序路径的界面验证、Windows NSIS打包、`node scripts/update-package-audit.mjs`；Mac任务新增同一订阅验证脚本。Android编译、原证书签名与模拟器启动使用既有流程。检查并修改文件包括上述偏好界面/规则、对应两个既有验证文件、版本号、Android版本声明、macOS工作流、AGENTS、README、CHANGELOG、发行说明与本记录；并行目录仅同步已核对一致的四个新闻文件与示例规则。

原始研究文件、已保存个人项目和真实用户数据未删除或读取，实际个人安装未替换。本轮检查针对当前源、默认文案、打包内容与合成示例；不改写历史Git提交。Mac采用ad-hoc签名，没有Apple公证；Android真机、学校会话和长期生产采集不属于本次验证。完整端侧功能对齐、顶部栏、工作文件夹与独立IMAP工作保留原边界。稳定的产品示例隔离要求已记录到共享DECISIONS，发行结果随后补记。

四平台安装包已发布到[公开V6.1.4发行](https://github.com/veritas123-s/Medstack-Program/releases/tag/v6.1.4)，远端附件大小、SHA256、下载URL与本地逐项一致，`releases/stable.json`与main一致。使用 `node scripts/publish-release.mjs releases/notes-6.1.4.json --publish`，公开目录提交 `c03983a`，新增验证文档提交仅改变记录。线上缓存已备份并同步，公开端点读回6.1.4四个平台及同一摘要，HTTPS健康200、匿名快讯401，无服务重启。最后只读复核 `inv-v9fq3fg9bd` 于11:00:55成功退出0；规范JSON摘要 `8482918625a101c7247d23e2f9e9662fbcda6e95c1067774fb74c4ff02bbed57`。本机证据 `test-results/public-release-proof.json` 和 `test-results/cloud-v614-announcement.txt/png`。最终私有发布隔离核验261个公开产品文件通过，私有目录不属于Git且发布入口拒绝执行。

| 平台 | 字节 | SHA256 |
| --- | ---: | --- |
| Windows x64 | 120888370 | b27060219f291b3d942cf611804f1f7ce637776358c8bdd84a94ba4a67b2b36b |
| Android | 2952843 | 53f4746ba4a2d9538bb9a928525b54d52695129c613676f6c1c1aabb0a77412c |
| macOS Intel x64 | 148161010 | 81926da5c51522522ce1c2e4d4fdbee7f16a4a16765faa346ef169afb98a9adc |
| macOS Apple Silicon arm64 | 142651167 | fc161914b4e8d44eb9e0a1ad19bdc0684d76c6a6d0c8bf95742bf0b818f7c6b4 |

独立IMAP开发目录随后也核对旧新闻文件与原公开基线逐字一致，并同步四个新闻偏好文件及AGENTS示例规则；对应三项偏好测试通过。其邮箱功能未在本轮合入或发布，其他文件保留。共享DECISIONS已记录当前用户的稳定内容隔离要求；项目状态及CHANGELOG在完成验收后追加，备份保留。
