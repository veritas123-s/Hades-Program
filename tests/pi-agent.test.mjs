import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runPi, workspaceTool } from '../src/agent/pi-runtime.mjs';
import { Workflows } from '../electron/workflows.mjs';
const messages=[{role:'system',content:'测试'}, {role:'user',content:'查看任务'}];
const call=(name='read_workspace',args='{}')=>({ choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'call-1',type:'function',function:{name,arguments:args}}]}}] });
const answer={choices:[{finish_reason:'stop',message:{content:'完成'}}]};
test('官方 Pi 执行工具后将结果送回模型，最终正常结束',async()=>{
 let step=0; let reads=0;
 const result=await runPi({model:'synthetic',messages,tools:[workspaceTool(()=>{reads++;return {tasks:[{title:'测试'}]};})],request:async body=>{
  if(++step===1) { assert.equal(body.tools[0].function.name,'read_workspace');return call(); }
  assert.equal(body.messages.at(-1).role,'tool');assert.match(body.messages.at(-1).content,/测试/);return answer;
 }});
 assert.equal(reads,1);assert.equal(result.turns,2);assert.equal(result.text,'完成');
});
test('未知工具与非法参数不执行，关闭工具时不发送工具描述',async()=>{
 let count=0,reads=0;
 const result=await runPi({model:'synthetic',messages,tools:[workspaceTool(()=>{reads++;return {};})],request:async()=> ++count===1?call('bash'):answer});
 assert.equal(reads,0);assert.equal(result.events[0].error,true);
 await runPi({model:'synthetic',messages,request:async body=>{assert.equal(body.tools,undefined);return answer;}});
});
test('Pi 步骤上限与取消不会继续无限调用或执行工具',async()=>{
 let reads=0;await assert.rejects(runPi({model:'synthetic',messages,tools:[workspaceTool(()=>{reads++;return {};})],maxTurns:2,request:async()=>call()}),/步骤上限/);assert.equal(reads,2);
 const c=new AbortController();c.abort();await assert.rejects(runPi({model:'synthetic',messages,signal:c.signal,request:async()=>{throw Error('不应访问');}}),/停止/);
});
test('旧工作流迁移保留删除归档与原文件，重启不覆盖新版配置',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'medstack-migration-'));
 try {
  const legacy=path.join(dir,Buffer.from('aGFkZXMtd29ya2Zsb3dzLmpzb24=','base64').toString());
  const prior={version:1,read:['abc'],audit:[],noticeArchive:[{id:'deleted',aliases:['abc'],deletedAt:123}],assignmentArchive:[],links:{}};
  fs.writeFileSync(legacy,JSON.stringify(prior));const a=new Workflows(dir);
  assert.equal(a.data.noticeArchive[0].deletedAt,123);assert.equal(fs.readFileSync(legacy,'utf8'),JSON.stringify(prior));
  a.data.autoCommit=true;a.save();assert.equal(new Workflows(dir).data.autoCommit,true);
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
