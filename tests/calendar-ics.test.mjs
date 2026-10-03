import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {initialState,taskInput,validateState} from '../src/domain.mjs';
import {eventInput} from '../src/domain/content.mjs';
import {parseCalendar,exportCalendar} from '../electron/calendar-ics.mjs';
import execute from '../electron/commands/calendar.mjs';
import {Store} from '../electron/store.mjs';
const range={start:'2026-09-01',end:'2026-10-31'};
const ics=(...events)=>['BEGIN:VCALENDAR','VERSION:2.0',...events,'END:VCALENDAR'].join('\r\n');
const event=(...lines)=>['BEGIN:VEVENT',...lines,'END:VEVENT'].join('\r\n');
test('无效日期、时间和倒置结束时间不会被悄悄修正',()=>{
 const p={start:'2026-01-01',end:'2026-12-31'};
 for(const lines of [['DTSTART:20260230T090000'],['DTSTART:20260928T250000'],['DTSTART:20260928T090000','DTEND:20260928T080000']]){
  const r=parseCalendar(ics(event('UID:bad',...lines)),p);assert.equal(r.events.length,0);assert.equal(r.warningCount,1);
 }
});
test('ICS导出中文折行、转义、UTC、全天以及稳定标识可往返',()=>{
 const s=initialState();s.tasks=[taskInput({title:'逗号,分号;与\\斜线',due:'2026-09-28',quadrant:'plan',notes:'私有备注'})];
 s.events=[eventInput({title:'中文日程'.repeat(35),start:'2026-09-28T09:00',end:'2026-09-28T10:00',notes:'行一\n行二'})];
 const result=exportCalendar(s,range,1000);assert.equal(result.count,2);assert.ok(!result.text.includes('私有备注'));
 for(const line of result.text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const parsed=parseCalendar(result.text,range);assert.equal(parsed.events.length,2);assert.equal(parsed.warnings.length,0);
 assert.equal(parsed.events.find(x=>!x.allDay).start,'2026-09-28T09:00');
 assert.equal(parsed.events.find(x=>x.allDay).end,'2026-09-29T00:00');
 assert.equal(parsed.events.find(x=>x.allDay).title,s.tasks[0].title);
 assert.deepEqual(parseCalendar(result.text,range).events.map(x=>x.id),parsed.events.map(x=>x.id));
});
test('ICS每周重复、排除日期、改单次与取消例外',()=>{
 const text=ics(event('UID:weekly','SUMMARY:周课','DTSTART:20260907T010000Z','DTEND:20260907T020000Z','RRULE:FREQ=WEEKLY;COUNT=4','EXDATE:20260914T010000Z'),event('UID:weekly','SUMMARY:调课','RECURRENCE-ID:20260921T010000Z','DTSTART:20260922T020000Z','DTEND:20260922T030000Z'),event('UID:weekly','SUMMARY:取消','RECURRENCE-ID:20260928T010000Z','DTSTART:20260928T010000Z','STATUS:CANCELLED'));
 const result=parseCalendar(text,range);assert.equal(result.events.length,2);assert.equal(result.events[1].title,'调课');assert.equal(result.events[1].start,'2026-09-22T10:00');
});
test('ICS缺失时区定义不会静默误移时间，上海和浮动时间按北京时间',()=>{
 const result=parseCalendar(ics(event('UID:unknown','SUMMARY:未知区','DTSTART;TZID=Mars/City:20260928T090000'),event('UID:sh','SUMMARY:上海','DTSTART;TZID=Asia/Shanghai:20260928T090000'),event('UID:float','SUMMARY:浮动','DTSTART:20260928T090000')),range);
 assert.equal(result.events.length,2);assert.equal(result.warningCount,1);assert.ok(result.events.every(x=>x.start==='2026-09-28T09:00'));
});
test('拒绝过大输入、过长范围与高频重复，忽略邀请和网络附件',()=>{
 assert.throws(()=>parseCalendar('x'.repeat(3e6),range));assert.throws(()=>parseCalendar(ics(),{start:'2020-01-01',end:'2026-01-01'}));
 const result=parseCalendar(ics(event('UID:rapid','DTSTART:20260928T090000','RRULE:FREQ=SECONDLY'),event('UID:safe','SUMMARY:安全日程','DTSTART:20260928T090000','ATTACH:https://example.invalid/private','ORGANIZER:mailto:synthetic@example.invalid')),range);
 assert.equal(result.warningCount,1);assert.equal(result.events.length,1);assert.ok(!JSON.stringify(result.events).includes('https://'));
});
test('全天与来源标识通过备份和第4版迁移保留，旧任务专注不改变',()=>{
 const s=initialState();s.schemaVersion=4;s.events=[eventInput({title:'全天',start:'2026-09-28T00:00',end:'2026-09-30T00:00',allDay:true,calendarUid:'sample-uid'})];
 const next=validateState(s);assert.equal(next.schemaVersion,6);assert.equal(next.events[0].calendarUid,'sample-uid');assert.equal(next.events[0].allDay,true);assert.deepEqual(next.logs,s.logs);assert.deepEqual(next.tasks,s.tasks);
});
test('预览不写入，确认去重，已删除与手工编辑不会被重复导入覆盖',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'medstack-ics-')),store=new Store(dir),file=path.join(dir,'synthetic.ics');
 fs.writeFileSync(file,ics(event('UID:synthetic','SUMMARY:导入事项','DTSTART:20260928T090000','DTEND:20260928T100000')));
 const ctx={store,fs,getWindow:()=>null,broadcast:()=>{},dialog:{showOpenDialog:async()=>({filePaths:[file],canceled:false})}};
 const p=await execute('calendar.import.preview',range,ctx);assert.equal(p.count,1);assert.equal(store.state.events.length,0);
 assert.equal((await execute('calendar.import.commit',{token:p.token},ctx)).count,1);assert.equal(store.state.events.length,1);
 store.change(s=>{s.events[0].title='手动改名';s.events[0].deletedAt=Date.now();});
 const p2=await execute('calendar.import.preview',range,ctx);assert.equal(p2.count,0);assert.equal(p2.duplicates,1);assert.equal(store.state.events[0].title,'手动改名');
 await execute('calendar.import.cancel',{},ctx);await assert.rejects(()=>execute('calendar.import.commit',{token:p2.token},ctx));
 assert.ok(fs.readdirSync(dir).some(x=>x.includes('backup')));
});
