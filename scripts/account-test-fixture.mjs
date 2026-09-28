// Main-process test injection only. No production login bypass or test account is packaged.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
export const fixtureProfile = (root) =>
  path.join(
    root,
    "accounts",
    createHash("sha256").update("synthetic-ui-account").digest("hex"),
  );
import { _electron as electron } from "playwright";
export async function launchAuthenticated(options) {
  let app = await electron.launch(options);
  const page = await unlockSyntheticAccount(app);
  if (
    (await page.evaluate(() => window.veritas.call("state"))).account
      .authenticated
  )
    return app;
  await page.getByRole("button", { name: "复制本机数据到这个账号" }).waitFor();
  await page.evaluate(() =>
    window.veritas.call("account.activate", { mode: "copy" }),
  );
  await clearSyntheticSession(app);
  await app.close();
  app = await electron.launch(options);
  const next = await unlockSyntheticAccount(app);
  await next.getByRole("heading", { name: "今天的安排" }).waitFor();
  return app;
}
export async function installSyntheticAccountNetwork(app) {
  await app.evaluate(({ net }) => {
    const original = net.fetch.bind(net);
    net.fetch = async (url, options) => {
      const route = new URL(url).pathname;
      if (!route.startsWith("/api/auth/")) return original(url, options);
      const user = {
        id: "synthetic-ui-account",
        email: "ui@synthetic.invalid",
        name: "合成验证账号",
      };
      return Response.json(
        { user },
        {
          headers: {
            "set-auth-token": "synthetic-ui-session-not-valid-on-server",
          },
        },
      );
    };
  });
}
export async function unlockSyntheticAccount(app) {
  await installSyntheticAccountNetwork(app);
  const page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "登录 Hades", exact: true })
    .or(page.getByRole("heading", { name: "今天的安排", exact: true }))
    .waitFor();
  if (
    (await page.evaluate(() => window.veritas.call("state"))).account
      .authenticated
  )
    return page;
  await page.getByLabel("邮箱", { exact: true }).fill("ui@synthetic.invalid");
  await page.getByLabel("密码", { exact: true }).fill("SyntheticPassword123!");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  return page;
}
export async function clearSyntheticSession(app) {
  const file = path.join(
    await app.evaluate(({ app }) => app.getPath("userData")),
    "account-vault.bin",
  );
  const bytes = await app.evaluate(({ safeStorage }, encoded) => {
    const data = JSON.parse(
      safeStorage.decryptString(Buffer.from(encoded, "base64")),
    );
    data.tokens = null;
    return safeStorage.encryptString(JSON.stringify(data)).toString("base64");
  }, fs.readFileSync(file).toString("base64"));
  fs.writeFileSync(file, Buffer.from(bytes, "base64"));
}
