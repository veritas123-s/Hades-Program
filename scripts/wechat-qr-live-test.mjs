// Read-only public-network probe. No account, cookies, or personal data.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { _electron as electron } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const application = await electron.launch({
  args: [path.join(root, "scripts/wechat-qr-probe.cjs")],
  env,
});
try {
  const result = await application.evaluate(async ({ nativeImage }) => {
    const { inspectWechatQR, decodeWechatQR, WECHAT_QR_ENTRIES } =
      await globalThis.medstackQRModule;
    let decodedEntry;
    const result = await inspectWechatQR({
      entry: WECHAT_QR_ENTRIES["上海交通大学医学院"],
      nativeImage,
      decoder: async (...args) =>
        (decodedEntry = await decodeWechatQR(...args)),
    });
    return { source: "上海交通大学医学院", decodedEntry, ...result };
  });
  assert.ok(result.decodedEntry.startsWith("https://weixin.qq.com/r/"));
  assert.ok(
    ["client-required", "public-links", "verification"].includes(result.status),
  );
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "test-results/wechat-qr-live.json"),
    JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await application.close();
}
