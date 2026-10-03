# Medtrix 入口标识

2026-10-04 用户要求去除入口 Medtrix 标志的白底，随后明确医栈通有自己的 logo，不能全部换成 Medtrix。保留 `BrandMark.jsx`、登录页主图形、左上角医栈通标志及系统安装图标。仅团队署名使用 `assets/medtrix-wordmark-transparent.png`。

以现有 `assets/medtrix-brand.png` 为来源，使用内置 imagegen 的 background-extraction 模式制作透明 PNG；保留原文件。单独生成的 M 图形未接入产品。

完整标志提示词：

> Remove the entire white background to actual transparency, preserving the existing Medtrix logo, original blue/cyan folded M symbol, white molecular connecting line and its three white round nodes, and the navy 'Medtrix' wordmark including cyan dot. Keep geometry, colors, gradients and letter shapes unchanged. Do not redesign or add shadows, borders, tiles or decorations. Export one transparent PNG containing the full symbol plus wordmark, centered on a tightly fitted landscape canvas with small transparent padding. Pixels around and within letter counters should be fully transparent where they were background; the white molecular line and nodes inside the M stay opaque white.

小图形提示词：

> Extract ONLY the left blue and turquoise folded M symbol with the white connecting molecular lines and all three white nodes. Remove the white background and the entire Medtrix wordmark. Keep the original M geometry, colors, gradients, white lines and circles; do not redesign or add anything. Real transparent alpha background. Center the M in a square PNG with modest transparent padding, spanning about 85% of the width. Sharp clean edges suitable for a 36px app navigation symbol. No text, border, tile or shadow.

桌面渲染核验：`node scripts/brand-preview.mjs`；发行程序可附加可执行文件路径。截图仅使用合成账号。Android 采用同一 PNG；源文件接入不等于 APK 已编译或真机验证。macOS 与 Windows 共用同一 React 标识组件，本机不声明 Mac 真机验证。
