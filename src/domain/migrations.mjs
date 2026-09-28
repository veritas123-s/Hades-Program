import { initialWorkspace } from "../platform/model.mjs";
export const CURRENT_DATA_VERSION = 5;
const migrations = {
  4: (data) => ({...data,schemaVersion:5,events:(data.events||[]).map(e=>({...e,allDay:!!e.allDay,calendarUid:e.calendarUid||''}))}),
  1: (data) => ({
    ...data,
    schemaVersion: 2,
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map((task) => ({ ...task, dueTime: task.dueTime || "" }))
      : data.tasks,
  }),
  2: (data) => ({
    ...data,
    schemaVersion: 3,
    workspace: data.workspace ?? initialWorkspace(),
  }),
  3: (data) => ({
    ...data,
    schemaVersion: 4,
    lists: data.lists ?? [],
    events: data.events ?? [],
    courseTrash: data.courseTrash ?? [],
  }),
};
export function migrateData(input) {
  if (
    !input ||
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion < 1
  )
    throw new Error("备份格式或版本不支持");
  if (input.schemaVersion > CURRENT_DATA_VERSION) {
    const error = new Error(
      "数据来自更新版本，请使用更新的 VERITAS 打开；原数据未改动。",
    );
    error.code = "NEWER_DATA_VERSION";
    throw error;
  }
  let data = structuredClone(input);
  while (data.schemaVersion < CURRENT_DATA_VERSION) {
    const migrate = migrations[data.schemaVersion];
    if (!migrate) throw new Error("缺少数据升级步骤，原数据未改动");
    data = migrate(data);
  }
  return data;
}
