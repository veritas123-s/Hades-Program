import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:process.env.MEDSTACK_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 const page=await browser.newPage();
 await page.route('https://medstack.local/**',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));
 await page.goto('https://medstack.local/');
 await page.evaluate(()=>{
  window.steps=[];window.done=null;
  window.NativePi={request(id,payload){const body=JSON.parse(payload);steps.push(body);
    const result=steps.length===1?{choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'read-1',type:'function',function:{name:'read_workspace',arguments:'{}'}}]}}]}:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'已整理，请核对',tasks:[{title:'合成复习',due:'2026-10-03',quadrant:'plan'}]})}}]};
    setTimeout(()=>MedstackPi.resolve(id,result),5);
  },completed(result){done=JSON.parse(result);}};
 });
 await page.addScriptTag({content:fs.readFileSync('android/app/src/main/assets/pi/agent.js','utf8')});
 await page.evaluate(()=>MedstackPi.run({model:'synthetic',text:'帮我安排复习',includeContext:true,workspace:{tasks:[],schedule:[]}}));
 await page.waitForFunction(()=>window.done!==null);
 const result=await page.evaluate(()=>({steps,done}));
 assert.equal(result.steps.length,2);assert.equal(result.steps[1].messages.at(-1).role,'tool');assert.equal(result.done.tasks[0].title,'合成复习');assert.equal(result.done.steps[0].name,'read_workspace');
 await page.evaluate(()=>{done=null;steps=[];NativePi.request=(id,payload)=>{steps.push(JSON.parse(payload));setTimeout(()=>MedstackPi.resolve(id,{choices:[{message:{content:'普通答复'}}]}),10);};});
 await page.evaluate(()=>MedstackPi.run({model:'synthetic',text:'问好',includeContext:false,workspace:{tasks:[{title:'不应发送的个人内容'}]}}));
 await page.waitForFunction(()=>window.done!==null);
 const clean=await page.evaluate(()=>steps);assert.ok(!JSON.stringify(clean).includes('不应发送的个人内容'));assert.equal(clean[0].tools,undefined);
 console.log('PASS 安卓内置 Pi bundle：两步工具调用、任务校验、关闭摘要不上传个人内容');
} finally {await browser.close();}
