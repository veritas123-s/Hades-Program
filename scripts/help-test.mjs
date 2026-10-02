import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const env = { ...process.env, VERITAS_TEST: "1", VERITAS_TEST_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "medstack-help-")) };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ executablePath, args: executablePath ? [] : ["."], env });
try {
  const page = await app.firstWindow();
  await page.getByRole("heading", { name: "登录 Medstack", exact: true }).waitFor();
  await app.evaluate(({shell}) => { globalThis.helpOpened = []; shell.openPath = async p => { globalThis.helpOpened.push(p); return ""; }; });
  for(const [title,name] of [["使用说明","USER-GUIDE.html"],["开发者手册 · Zeus","DEVELOPER-HANDBOOK.html"]]) {
    await page.getByRole("button", { name:title, exact:true }).click();
    await page.waitForTimeout(150);
    const actual = await app.evaluate(()=>globalThis.helpOpened.at(-1));
    assert.ok(actual.endsWith(name));
    assert.equal(fs.existsSync(actual),true);
  }
  await assert.rejects(()=>page.evaluate(()=>window.veritas.call("help.open",{kind:"../account-vault.bin"})),/未知/);
  const state=await page.evaluate(()=>window.veritas.call("state"));assert.equal(state.locked,true);assert.equal(state.tasks,undefined);
  await assert.rejects(()=>page.evaluate(()=>window.veritas.call("assistant.state")),/登录/);
  const suffix=executablePath?.includes('ia32')?'ia32':executablePath?'x64':'source';
  await page.screenshot({path:`test-results/v31-help-login-${suffix}.png`});
  const directory=executablePath?path.join(path.dirname(executablePath),'帮助文档'):path.resolve('docs/offline');
  for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.html'))) {
    const text=fs.readFileSync(path.join(directory,name),'utf8');
    for(const [,href] of text.matchAll(/href="([^"]+)"/g)) {
      if(href.startsWith('#'))assert.ok(text.includes(`id="${href.slice(1)}"`));
      else if(!href.startsWith('https://'))assert.ok(fs.existsSync(path.join(directory,href)),`Missing local help link ${href}`);
    }
  }
  for(const name of ['USER-GUIDE','DEVELOPER-HANDBOOK']) {
    const newPage=app.waitForEvent('window');
    await app.evaluate(async ({BrowserWindow},file)=>{ const w=new BrowserWindow({width:1300,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});await w.loadFile(file); },path.join(directory,name+'.html'));
    const doc=await newPage;await doc.locator('h1').waitFor();
    assert.ok(await doc.locator('h2').count()>=13);
    assert.equal(await doc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await doc.locator('script').count(),0);
    await doc.screenshot({path:`test-results/v31-${name}-${suffix}.png`});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().at(-1).setSize(480,820));
    assert.equal(await doc.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().at(-1).destroy());
  }
  console.log(JSON.stringify({passed:true,executablePath:executablePath||'source',publicHelp:true,personalGate:true,offlineLinks:true,responsive:true}));
} finally { await app.close(); }
