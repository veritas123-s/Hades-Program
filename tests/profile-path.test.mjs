import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { isRedirectedProfile } = createRequire(import.meta.url)(
  "../electron/profile-path.cjs",
);
test("拒绝把开发宿主重定向的 AppData 当作桌面真实用户目录", () => {
  assert.equal(
    isRedirectedProfile(
      "C:/Users/User/AppData/Roaming/AI-VERITAS",
      "C:/Users/User/AppData/Local/Packages/Host_123/LocalCache/Roaming/AI-VERITAS",
    ),
    true,
  );
});
test("正常桌面目录、普通联接与显式隔离测试目录不会误报", () => {
  assert.equal(
    isRedirectedProfile(
      "C:/Users/User/AppData/Roaming/AI-VERITAS",
      "C:/Users/User/AppData/Roaming/AI-VERITAS",
    ),
    false,
  );
  assert.equal(
    isRedirectedProfile(
      "C:/Users/User/AppData/Roaming/AI-VERITAS",
      "E:/UserData/AI-VERITAS",
    ),
    false,
  );
  const isolated =
    "C:/Users/User/AppData/Local/Packages/Host_123/LocalCache/Roaming/AI-VERITAS";
  assert.equal(isRedirectedProfile(isolated, isolated), false);
});
