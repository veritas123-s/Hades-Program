import { initialState, validateState } from "./domain.mjs";
export const CLOUD_KEYS = [
  "schemaVersion",
  "tasks",
  "lists",
  "events",
  "courseTrash",
  "logs",
  "courses",
  "courseRanges",
  "settings",
  "workspace",
];
export const MAX_CLOUD_BYTES = 800 * 1024;
export function cloudDocument(state) {
  const validated = validateState(state);
  // Existing server protocol remains v5. Research records stay account-local.
  return Object.fromEntries(
    CLOUD_KEYS.map((key) => [
      key,
      key === "schemaVersion" ? 5 : validated[key],
    ]),
  );
}
export function validateCloudDocument(document) {
  if (
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    Object.keys(document).some((key) => !CLOUD_KEYS.includes(key)) ||
    CLOUD_KEYS.some((key) => !(key in document))
  )
    throw Error("云端数据格式无效");
  if (
    new TextEncoder().encode(JSON.stringify(document)).length > MAX_CLOUD_BYTES
  )
    throw Error("同步数据超过800KB，请导出备份并联系开发者扩容");
  return cloudDocument({ ...initialState(), ...document });
}
export function cloudSummary(document) {
  return {
    tasks: document.tasks.filter((x) => !x.deletedAt).length,
    events: document.events.filter((x) => !x.deletedAt).length,
    courses: document.courses.length,
    logs: document.logs.filter((x) => !x.deletedAt).length,
    focusMs: document.logs
      .filter((x) => !x.deletedAt)
      .reduce((n, x) => n + x.durationMs, 0),
  };
}
