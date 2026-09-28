import {parentPort,workerData} from 'node:worker_threads';
import {parseCalendar} from './calendar-ics.mjs';
try{parentPort.postMessage({result:parseCalendar(workerData.text,workerData.options)});}catch(e){parentPort.postMessage({error:e.message});}
