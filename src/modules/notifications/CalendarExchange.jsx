import Panel from "../../shared/Panel.jsx";
import React,{useState} from 'react';
import {Download,Upload,CheckCircle2} from 'lucide-react';
import {Modal} from '../../components.jsx';
import {beijingDay} from '../../briefing.mjs';
import {shiftDate} from '../../calendar.mjs';
export default function CalendarExchange({call,onClose}){
 const today=beijingDay();
 const [mode,setMode]=useState('export'),[start,setStart]=useState(today),[end,setEnd]=useState(shiftDate(today,1,'year'));
 const [kinds,setKinds]=useState(['task','course','event']),[notes,setNotes]=useState(false),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const run=async action=>{setBusy(true);setError('');setMessage('');try{
  if(action==='export'){const r=await call('calendar.export',{start,end,kinds,notes});if(!r.canceled)setMessage(`已导出 ${r.count} 条日程，可在其他日历中导入。`);}
  else if(action==='preview'){setPreview(null);const r=await call('calendar.import.preview',{start,end});if(!r.canceled)setPreview(r);}
  else {const r=await call('calendar.import.commit',{token:preview.token});setPreview(null);setMessage(`已添加 ${r.count} 条日程。可在日历中编辑、删除与恢复。`);}
 }catch(e){setError(e.message);}finally{setBusy(false);}};
 const reset=()=>{setPreview(null);call('calendar.import.cancel').catch(()=>{});};
 return <Modal title="日历导入与导出" onClose={()=>{reset();onClose();}}>
  <div className="exchange-tabs" role="group" aria-label="日历文件操作">{[['export','导出日历'],['import','导入日历']].map(([id,label])=><button key={id} className={'button '+(mode===id?'primary':'')} disabled={busy} onClick={()=>{setMode(id);reset();setMessage('');setError('');}}>{label}</button>)}</div>
  <p className="exchange-intro">使用通用 ICS 文件与 Google Calendar、Apple Calendar 等交换日程。文件导入是一次复制，后续修改不会自动同步。</p>
  <div className="form-grid">{[['范围开始',start,setStart],['范围结束',end,setEnd]].map(([label,value,setter])=><label key={label}>{label}<input type="date" aria-label={label} value={value} min="2000-01-01" max="2099-12-31" disabled={busy} onChange={e=>{setter(e.target.value);reset();}}/></label>)}</div>
  {mode==='export'?<>
   <div className="exchange-kinds">{[['task','任务截止'],['course','校园课程'],['event','手动及导入日程']].map(([id,label])=><label key={id}><input type="checkbox" checked={kinds.includes(id)} onChange={e=>setKinds(e.target.checked?[...kinds,id]:kinds.filter(x=>x!==id))}/>{label}</label>)}</div>
   <label className="toggle-row"><span>包含任务与日程备注</span><input type="checkbox" checked={notes} onChange={e=>setNotes(e.target.checked)}/></label>
   <p className="hint">默认不导出备注。文件会包含选中事项的标题、时间及课程地点，请自行决定是否分享。</p>
   <button className="button primary" disabled={busy||!kinds.length} onClick={()=>run('export')}><Download size={17}/>{busy?'正在导出…':'保存 ICS 文件'}</button>
  </>:<>
   <p className="hint">按北京时间显示；支持全天、标准时区及常见重复日程。先预览再添加，重复导入会跳过已有事项，不覆盖手动修改，也不恢复已删除内容。</p>
   <button className="button" disabled={busy} onClick={()=>run('preview')}><Upload size={17}/>{busy?'正在读取…':'选择 ICS 文件'}</button>
   {preview&&<Panel className="exchange-preview" aria-label="导入预览"><h3>将添加 {preview.count} 条日程</h3><p>已跳过 {preview.duplicates} 条重复，{preview.excluded} 条在范围外或已取消。</p>
    {preview.warningCount>0&&<details open><summary>{preview.warningCount} 项需要注意</summary><ul>{preview.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    <div className="exchange-items">{preview.items.map((e,i)=><div key={i}><strong>{e.title}</strong><span>{e.start.replace('T',' ')} · {e.allDay?'全天':e.end.slice(11)}</span></div>)}</div>
    {preview.count>40&&<p className="hint">仅预览前40条；确认后将添加全部 {preview.count} 条。</p>}
    <button className="button primary" disabled={busy||!preview.count} onClick={()=>run('commit')}><CheckCircle2 size={17}/>确认添加 {preview.count} 条</button>
   </Panel>}
  </>}
  {message&&<p className="success" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
 </Modal>;
}
