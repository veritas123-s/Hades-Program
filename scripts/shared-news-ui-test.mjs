import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { launchAuthenticated, clearSyntheticSession } from "./account-test-fixture.mjs";
import { WECHAT_SOURCES } from "../electron/news-service.mjs";
const root=path.resolve(import.meta.dirname,".."),directory=fs.mkdtempSync(path.join(os.tmpdir(),"medstack-shared-ui-"));
const output=path.join(root,"test-results/shared-news");fs.mkdirSync(output,{recursive:true});
const env={...process.env,VERITAS_TEST:"1",VERITAS_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
let app;const checks=[],errors=[];
try {
  app=await launchAuthenticated(process.argv[2]?{executablePath:path.resolve(process.argv[2]),args:[],env}:{args:[root],env});
  const page=await app.firstWindow();page.on("pageerror",e=>errors.push(e.message));
  const tour=page.getByRole("dialog",{name:"医栈通 新手教程"});if(await tour.isVisible())await tour.getByRole("button",{name:"跳过",exact:true}).click();
  await app.evaluate(({net},sources)=>{
    const original=net.fetch.bind(net);let started=Date.now();
    net.fetch=async(url,options)=>new URL(url).pathname==="/api/news/shared"?Response.json({version:1,serverNow:Date.now()+9*3600000,nextRunAt:started+9*3600000+8000,sources,
      lastFinishedAt:Date.now(),coverage:sources.map(source=>({source,status:"unavailable",note:"合成来源失败，保留缓存"})),items:[{id:"synthetic-news",source:sources[0],title:"合成校园消息",publishedAt:Date.now()-1000,date:"2026-10-04",url:"https://mp.weixin.qq.com/s/synthetic",excerpt:"用于倒计时验证的合成文章"}]}):original(url,options);
  },WECHAT_SOURCES);
  await page.locator(".sidebar nav").getByRole("button",{name:"校园快讯",exact:true}).click();
  await page.getByRole("button",{name:"同步最新信息",exact:true}).click();
  const countdown=page.getByTestId("news-countdown");await countdown.getByText(/距下次刷新 00:00:0/).waitFor();
  const first=await countdown.innerText();await page.waitForFunction(first=>document.querySelector('[data-testid="news-countdown"]').textContent!==first,first);
  checks.push("每秒变化，服务器时钟偏移9小时仍显示正确余时");
  await page.getByText("每天每小时整点采集 · 12 个公众号").waitFor();
  await page.getByRole("button",{name:"组织专栏",exact:true}).click();
  await page.getByRole("button",{name:"合成校园消息",exact:true}).waitFor();
  checks.push("共享服务器消息实际经过主进程进入用户列表");
  for(const width of [1400,720]) {
    await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setBounds({width,height:900}),width);
    assert.equal(await page.locator('.news-refresh-status').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
    await page.screenshot({path:path.join(output,`countdown-${width}.png`)});
  }
  checks.push("宽窄窗口倒计时不溢出");
  await countdown.getByText("等待服务器刷新结果",{exact:true}).waitFor();
  checks.push("归零显示等待实际采集结果，不虚构成功");
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,"result.json"),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}finally{if(app){await clearSyntheticSession(app);await app.close();}}
