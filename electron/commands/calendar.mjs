import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {exportCalendar,calendarUid,dateRange} from '../calendar-ics.mjs';
import {calendarEvents} from '../../src/calendar.mjs';
const previews=new WeakMap();
function parse(text,options){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('../calendar-worker.mjs',import.meta.url),{workerData:{text,options},resourceLimits:{maxOldGenerationSizeMb:96}});
 const timeout=setTimeout(()=>{worker.terminate();reject(Error('日历解析超时，请缩小文件或日期范围'));},8000);
 worker.once('message',m=>{clearTimeout(timeout);worker.terminate();m.error?reject(Error(m.error)):resolve(m.result);});
 worker.once('error',e=>{clearTimeout(timeout);reject(Error('日历解析失败：'+e.message));});
 worker.once('exit',code=>{clearTimeout(timeout);if(code!==0)reject(Error('日历解析已停止'));});
});}
export default async function execute(action,p,{store,dialog,fs,broadcast,getWindow}){
 if(action==='calendar.export'){
  const result=exportCalendar(store.state,p);
  const file=await dialog.showSaveDialog(getWindow(),{defaultPath:`Hades-${p.start}-${p.end}.ics`,filters:[{name:'通用日历',extensions:['ics']}]});
  if(file.canceled)return {canceled:true};
  fs.writeFileSync(file.filePath,result.text,'utf8');return {count:result.count};
 }
 if(action==='calendar.import.preview'){
  dateRange(p);previews.delete(store);
  const file=await dialog.showOpenDialog(getWindow(),{properties:['openFile'],filters:[{name:'通用日历',extensions:['ics']}]});
  if(file.canceled)return {canceled:true};
  if(fs.statSync(file.filePaths[0]).size>2*1024*1024)throw Error('日历文件超过2MB');
  const result=await parse(fs.readFileSync(file.filePaths[0],'utf8'),p);
  const known=new Set([...calendarEvents(store.state).map(calendarUid),...store.state.events.map(x=>x.calendarUid).filter(Boolean)]);
  const fresh=result.events.filter(e=>!known.has(e.calendarUid)&&!store.state.events.some(x=>x.id===e.id));
  const token=randomUUID();previews.set(store,{token,events:fresh,expires:Date.now()+10*60000});
  return {token,count:fresh.length,duplicates:result.events.length-fresh.length,excluded:result.excluded,warnings:result.warnings,warningCount:result.warningCount,items:fresh.slice(0,40).map(({title,start,end,allDay})=>({title,start,end,allDay}))};
 }
 if(action==='calendar.import.cancel'){previews.delete(store);return {canceled:true};}
 const preview=previews.get(store);
 if(!preview||preview.token!==p.token||preview.expires<Date.now())throw Error('预览已过期，请重新选择文件');
 const known=new Set([...calendarEvents(store.state).map(calendarUid),...store.state.events.map(x=>x.calendarUid).filter(Boolean)]);
 const fresh=preview.events.filter(e=>!known.has(e.calendarUid)&&!store.state.events.some(x=>x.id===e.id));
 if(fresh.length){store.backup();store.change(s=>s.events.push(...fresh));broadcast();}
 previews.delete(store);return {count:fresh.length};
}
