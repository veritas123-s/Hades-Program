import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {launchAuthenticated} from './account-test-fixture.mjs';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'medstack-package-pi-'));
const env={...process.env,VERITAS_TEST:'1',VERITAS_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
 app=await launchAuthenticated({executablePath:path.resolve(process.argv[2] || 'release-medstack-5.0/win-unpacked/Medstack.exe'),args:[],env});
 const page=await app.firstWindow();assert.equal(await app.evaluate(({app})=>app.getVersion()),'5.0.0');
 await app.evaluate(({net})=>{
  const previous=net.fetch.bind(net);let step=0;
  net.fetch=async(url,options)=>{
   if(!url.startsWith('https://models.sjtu.edu.cn/api/v1/'))return previous(url,options);
   const body=JSON.parse(options.body);
   if(body.messages.some(m=>String(m.content).includes('synthetic-package-private-key')))throw Error('Key leaked into model context');
   if(++step===1) {if(body.tools[0].function.name!=='read_workspace')throw Error('Pi tools missing');return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{id:'context-1',type:'function',function:{name:'read_workspace',arguments:'{}'}}]}}]});}
   if(body.messages.at(-1).role!=='tool')throw Error('Tool result not fed to model');
   return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'请核对',tasks:[{title:'合成任务',quadrant:'plan'}]})}}]});
  };
 });
 const call=(action,payload={})=>page.evaluate(([action,payload])=>window.veritas.call(action,payload),[action,payload]);
 await call('assistant.configure',{key:'synthetic-package-private-key',model:'deepseek-chat'});
 const result=await call('assistant.chat',{text:'请读取安排，然后生成一项任务',includeContext:true});
 assert.equal(result.architecture,'Pi Agent Core 1.0.0');assert.equal(result.history.at(-1).steps[0].name,'read_workspace');assert.equal(result.history.at(-1).tasks[0].title,'合成任务');assert.equal((await call('state')).tasks.length,0);
 assert.ok(!JSON.stringify(result).includes('synthetic-package-private-key'));
 await call('assistant.commit',{id:result.history.at(-1).id,tasks:result.history.at(-1).tasks});assert.equal((await call('state')).tasks.length,1);
 fs.writeFileSync('test-results/medstack-package-pi.json',JSON.stringify({passed:true,version:'5.0.0',steps:2,tools:['read_workspace'],draftBeforeCommit:true,keyRedacted:true}));
 console.log('PASS 实际发行程序：Pi 两步工具调用、核对后入库、密钥不进上下文或历史');
}finally{if(app)await app.close();fs.rmSync(directory,{recursive:true,force:true});}
