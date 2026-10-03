import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { _electron as electron } from "playwright";
import {
  launchAuthenticated,
  clearSyntheticSession,
} from "./account-test-fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "medstack-brand-preview-"));
const output = path.join(root, "test-results", "branding");
fs.mkdirSync(output, { recursive: true });
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: data };
delete env.ELECTRON_RUN_AS_NODE;
const options = {
  env,
  ...(process.argv[2]
    ? { executablePath: path.resolve(process.argv[2]), args: [] }
    : { args: [root] }),
};
let app;
try {
  app = await electron.launch(options);
  let page = await app.firstWindow();
  await page
    .getByRole("heading", { name: "登录 医栈通", exact: true })
    .waitFor();
  await page.locator(".auth-brand .medstack-mark").waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("img")].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.screenshot({ path: path.join(output, "login.png") });
  await app.close();
  app = undefined;
  app = await launchAuthenticated(options);
  page = await app.firstWindow();
  const tour = page.getByRole("dialog", { name: "医栈通 新手教程" });
  if (await tour.isVisible())
    await tour.getByRole("button", { name: "跳过", exact: true }).click();
  for (const theme of ["paper", "midnight", "medical"]) {
    await page.evaluate(
      (theme) => window.veritas.call("workspace.configure", { theme }),
      theme,
    );
    await page.waitForFunction(
      (theme) => document.documentElement.dataset.theme === theme,
      theme,
    );
    for (const width of [1400, 720]) {
      await app.evaluate(({ BrowserWindow }, width) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setBounds({ width, height: 900 });
        win.webContents.setZoomFactor(width === 720 ? 1.5 : 1);
      }, width);
      await page.screenshot({
        path: path.join(output, `${theme}-${width}.png`),
        animations: "disabled",
      });
    }
  }
  console.log(
    JSON.stringify({ completed: true, screenshots: 7, data: "synthetic" }),
  );
} finally {
  if (app) {
    await clearSyntheticSession(app);
    await app.close();
  }
}
