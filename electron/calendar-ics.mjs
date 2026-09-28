import ICAL from 'ical.js';
import {createHash} from 'node:crypto';
import {calendarEvents, calendarDate, shiftDate} from '../src/calendar.mjs';
import {eventInput, courseKey} from '../src/domain/content.mjs';
const DAY=86400000, hash=x=>createHash('sha256').update(x).digest('hex');
const local=ms=>new Date(ms+8*3600000).toISOString().slice(0,16);
const utc=ms=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function dateRange(p){
 if(!calendarDate(p.start)||!calendarDate(p.end)||p.end<p.start)throw Error('请选择有效日期范围');
 const from=Date.parse(p.start+'T00:00:00+08:00'),to=Date.parse(p.end+'T00:00:00+08:00')+DAY;
 if(to-from>2*366*DAY)throw Error('一次最多处理两年日程');return {from,to};
}
export const calendarUid=e=>e.kind==='course'?`course-${hash(courseKey(e.course))}@hades.local`:e.kind==='event'?(e.event.calendarUid||`event-${e.event.id}@hades.local`):`task-${e.task.id}@hades.local`;
const escape=x=>String(x||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
function fold(line){let result='',part='';for(const c of line){if(Buffer.byteLength(part+c)>75){result+=part+'\r\n';part=' ';}part+=c;}return result+part;}
export function exportCalendar(state,p,now=Date.now()){
 const {from,to}=dateRange(p), kinds=new Set(p.kinds||['task','course','event']);
 const events=calendarEvents(state,{showCompleted:!!p.completed}).filter(e=>kinds.has(e.kind)&&e.start<to&&(e.end>from||e.start>=from));
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hades//Calendar 3.0//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Hades 日程'];
 for(const e of events){
  lines.push('BEGIN:VEVENT','UID:'+escape(calendarUid(e)),'DTSTAMP:'+utc(now),'SUMMARY:'+escape(e.title));
  if(e.allDay)lines.push('DTSTART;VALUE=DATE:'+e.day.replaceAll('-',''),'DTEND;VALUE=DATE:'+shiftDate(e.lastDay,1).replaceAll('-',''));
  else lines.push('DTSTART:'+utc(e.start),'DTEND:'+utc(e.end>e.start?e.end:e.start+60000));
  const detail=e.kind==='course'?e.course.location:e.kind==='event'?e.event.location:'';
  if(detail)lines.push('LOCATION:'+escape(detail));
  const notes=p.notes?(e.task?.notes||e.event?.notes||''):'';
  lines.push('DESCRIPTION:'+escape((e.kind==='task'?'任务截止':'')+(notes?'\n'+notes:'')),'END:VEVENT');
 }
 lines.push('END:VCALENDAR');return {text:lines.map(fold).join('\r\n')+'\r\n',count:events.length};
}
// ICAL definitions handle DST. An unknown TZID must not silently become UTC.
function instant(time,property){
 const zone=property?.getParameter('tzid');
 if(time.isDate||(!zone&&time.zone.tzid==='floating'))return Date.parse(time.toString().slice(0,10)+'T'+(time.isDate?'00:00:00':time.toString().slice(11,19))+'+08:00');
 if(zone&&time.zone.tzid==='floating'){
  if(['Asia/Shanghai','Asia/Chongqing','Asia/Hong_Kong','Asia/Taipei'].includes(zone))return Date.parse(time.toString().slice(0,19)+'+08:00');
  throw Error('时区缺少定义：'+zone);
 }
 return time.toUnixTime()*1000;
}
export function parseCalendar(text,p){
 const {from,to}=dateRange(p);
 if(typeof text!=='string'||Buffer.byteLength(text)>2*1024*1024)throw Error('日历文件超过2MB');
 ICAL.TimezoneService.reset();
 let root;try{root=new ICAL.Component(ICAL.parse(text.replace(/^\uFEFF/,'')));}catch{throw Error('无法读取日历文件，请选择标准ICS文件');}
 if(root.name!=='vcalendar')throw Error('文件不是日历格式');
 for(const component of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(component.getFirstPropertyValue('tzid'),new ICAL.Timezone(component));
 const components=root.getAllSubcomponents('vevent');
 if(components.length>5000)throw Error('日程数量过多，请缩小导出范围');
 const events=[],warnings=[],seen=new Set();let excluded=0,iterations=0;
 if(root.getAllSubcomponents('vtodo').length)warnings.push('文件含独立待办VTODO，本次只导入日程VEVENT。');
 const exceptions=new Map();
 for(const c of components)if(c.hasProperty('recurrence-id')){const uid=c.getFirstPropertyValue('uid');const list=exceptions.get(uid)||[];list.push(c);exceptions.set(uid,list);}
 for(const c of components){
  if(c.hasProperty('recurrence-id'))continue;
  const title=String(c.getFirstPropertyValue('summary')||'未命名日程').slice(0,300);
  try{
   validateDates(c);
   if(c.getFirstPropertyValue('status')==='CANCELLED'){excluded++;continue;}
   const uid=String(c.getFirstPropertyValue('uid')||hash(c.toString()));
   if(uid.length>500)throw Error('日程标识过长');
   const event=new ICAL.Event(c,{exceptions:(exceptions.get(uid)||[]).map(x=>{validateDates(x);return new ICAL.Event(x);})});
   if(!event.startDate)throw Error('缺少开始时间');
   const rule=c.getFirstPropertyValue('rrule');
   if(rule&&!['DAILY','WEEKLY','MONTHLY','YEARLY'].includes(rule.freq))throw Error('不支持每小时或更密集的重复');
   const iterator=event.isRecurring()?event.iterator():null;
   let occurrence=iterator?iterator.next():event.startDate;
   while(occurrence){
    if(++iterations>20000)throw Error('重复展开达到上限，请缩短范围');
    const detail=iterator?event.getOccurrenceDetails(occurrence):{startDate:event.startDate,endDate:event.endDate,item:event};
    const item=detail.item;
    const start=instant(detail.startDate,item.component.getFirstProperty('dtstart'));
    let end=instant(detail.endDate,item.component.getFirstProperty('dtend')||item.component.getFirstProperty('dtstart'));
    if(iterator&&start>=to)break;
    if(item.component.getFirstPropertyValue('status')==='CANCELLED'){occurrence=iterator?.next();continue;}
    if(end<=start){
     if(item.component.hasProperty('dtend')||item.component.hasProperty('duration'))throw Error('结束时间必须晚于开始时间');
     end=start+(detail.startDate.isDate?DAY:3600000);
    }
    if(start<to&&end>from){
     const key=uid+(iterator?'#'+occurrence.toString():'');
     if(!seen.has(key)){
      const entry=eventInput({title:item.summary||title,start:local(start),end:local(end),allDay:detail.startDate.isDate,calendarUid:key,location:item.location||'',notes:item.description||''},{id:'ics-'+hash(key).slice(0,40)});
      events.push(entry);seen.add(key);if(events.length>2000)throw Error('最多导入2000条日程，请缩小范围');
     }
    }else excluded++;
    occurrence=iterator?.next();
   }
  }catch(e){
   if(iterations>20000||events.length>2000)throw e;
   warnings.push(title+'：'+e.message);
  }
 }
 const orphan=[...exceptions.keys()].filter(uid=>!components.some(c=>!c.hasProperty('recurrence-id')&&c.getFirstPropertyValue('uid')===uid)).length;
 if(orphan)warnings.push(`${orphan}组重复例外缺少原始日程，未导入。`);
 return {events,warnings:warnings.slice(0,30),warningCount:warnings.length,excluded};
}
function validateDates(component){
 for(const name of ['dtstart','dtend','recurrence-id','rdate','exdate'])for(const property of component.getAllProperties(name)){
  const [, ,type,...values]=property.toJSON();
  if(!['date','date-time'].includes(type))throw Error('不支持的日期格式');
  for(const value of values){
   if(typeof value!=='string'||!calendarDate(value.slice(0,10)))throw Error('日历含无效日期');
   if(type==='date-time'&&!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ?$/.test(value))throw Error('日历含无效时间');
  }
 }
}
