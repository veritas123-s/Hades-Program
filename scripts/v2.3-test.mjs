import { launchAuthenticated } from "./account-test-fixture.mjs";
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {initialState,taskInput} from '../src/domain.mjs';
import {learningTaskId} from '../electron/workflows.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'medstack23-ui-'));
const env={...process.env,VERITAS_TEST:'1',VERITAS_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
const now=Date.now(), day=86400000, seed=initialState();seed.workspace.theme='paper';
const assignment=(id,title,patch={})=>({id:`work:1:2:${id}`,kind:'assignment',courseKey:'1:2',course:'合成当前课',title,done:false,...patch});
const items=[
  {id:'notice:7',title:'合成待删除通知',kind:'notice',updatedAt:now},
  {id:'notice:8',title:'合成历史通知',kind:'notice',updatedAt:now-90*day},
  assignment(1,'合成近期作业',{deadline:now+day}),
  assignment(2,'合成年份不明旧作业',{deadline:now+day,yearInferred:true,courseKey:'3:4',course:'合成旧课程'}),
  assignment(3,'合成已完成作业',{done:true}),
];
seed.tasks=[taskInput({title:'手动保留任务',quadrant:'plan'}),taskInput({title:'合成年份不明旧作业',quadrant:'plan',due:new Date(now).toISOString().slice(0,10)},{id:learningTaskId(items[3].id)})];
fs.writeFileSync(path.join(dir,'veritas-data.json'),JSON.stringify(seed));
fs.writeFileSync(path.join(dir,'learning-cache.json'),JSON.stringify({version:1,items,lastSuccess:now,courses:[{key:'1:2',title:'合成当前课',archived:false},{key:'3:4',title:'合成旧课程',archived:false}],catalogComplete:true}));
let app,page;const errors=[],checks=[];
const pass=x=>{checks.push(x);console.log('PASS '+x)};
const call=(a,p={})=>page.evaluate(([a,p])=>window.veritas.call(a,p),[a,p]);
const button=name=>page.getByRole('button',{name,exact:true});
const visible=title=>page.locator('.notification-list').getByRole('heading',{name:title,exact:true});
async function launch(){app=await launchAuthenticated(process.argv[2]?{executablePath:path.resolve(process.argv[2]),args:[],env}:{args:[process.cwd()],env});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('heading',{name:'今天的安排'}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,1000));await button('打开通知中心').click();await page.getByRole('heading',{name:'日程与通知',exact:true}).waitFor();}
try{
 await launch();
 await visible('合成近期作业').waitFor();
 assert.equal(await visible('合成年份不明旧作业').count(),0);
 assert.equal(await visible('合成历史通知').count(),0);
 await button('删除通知 合成待删除通知').click();
 await visible('合成待删除通知').waitFor({state:'detached'});
 await button('未读').click();
 assert.equal(await visible('合成待删除通知').count(),0);
 pass('全部/未读列表排除历史、旧课及已删除通知');
 await page.getByRole('button',{name:/历史与待确认/}).click();
 await visible('合成年份不明旧作业').waitFor();
 await page.locator('.learning-course-manager summary').click();
 await page.getByLabel('关注课程 合成旧课程').selectOption('follow');
 await button('全部').click();await visible('合成年份不明旧作业').waitFor();
 await page.getByLabel('关注课程 合成旧课程').selectOption('hide');
 await visible('合成年份不明旧作业').waitFor({state:'detached'});
 assert.ok((await call('state')).tasks.find(t=>t.title==='手动保留任务'));
 pass('课程手动关注与不关注立即生效，手动任务保留');
 await app.close();await launch();
 await app.evaluate(({session})=>{
   session.fromPartition('medstack-learning').fetch=async url=>{
    if(url.includes('backclazzdata'))return new Response(JSON.stringify({result:1,channelList:[{content:{id:2,cpi:3,isretire:0,course:{data:[{id:1,name:'合成当前课'}]}}}]}));
    if(url.includes('stucoursemiddle'))return new Response('<input id="workEnc" value="0123456789abcdef0123456789abcdef"><input id="enc" value="stub"><input id="openc" value="stub">');
    if(url.includes('/work/list'))return new Response('<ul><li data="https://mooc1.chaoxing.com/mooc-ans/mooc2/work/task?workId=1"><p class="overHidden2">合成近期作业</p><p class="status">未交</p><div class="time">'+new Date(Date.now()+86400000+8*3600000).toISOString().slice(0,16).replace('T',' ')+'</div></li></ul>');
    if(url.includes('getNoticeList'))return new Response(JSON.stringify({status:true,notices:{list:[{id:7,uuid:'uuid7',title:'合成待删除通知',completeTime:Date.now()}],lastPage:true}}));
    throw Error('Unexpected URL');
   };
 });
 await call('learning.sync');
 assert.equal(await visible('合成待删除通知').count(),0);
 await button('未读').click();assert.equal(await visible('合成待删除通知').count(),0);
 await button('全部').click();
 let s=await call('state');const task=s.tasks.find(t=>t.title==='合成近期作业');assert.ok(task);
 assert.equal(s.tasks.filter(t=>t.title==='合成年份不明旧作业').length,1);
 pass('重启后再次同步兼容通知UUID，旧删除持续有效且不重复导入');
 await button('删除作业 合成近期作业').click();await visible('合成近期作业').waitFor({state:'detached'});
 s=await call('state');assert.ok(s.tasks.find(t=>t.id===task.id).deletedAt);
 await page.getByRole('button',{name:/^已删除/}).click();await visible('合成近期作业').waitFor();
 await button('恢复作业 合成近期作业').click();
 await button('全部').click();await visible('合成近期作业').waitFor();
 s=await call('state');assert.equal(s.tasks.find(t=>t.id===task.id).deletedAt,null);assert.deepEqual(s.logs,seed.logs);
 pass('删除与恢复作业联动本机任务，专注记录完整');
 await page.locator('.learning-course-manager summary').click();
 await page.screenshot({path:'test-results/v2.3-notifications.png',fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync('test-results/v2.3-ui.json',JSON.stringify({passed:true,checks},null,2));
}finally{await app?.close();}
