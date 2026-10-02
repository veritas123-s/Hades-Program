Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region ../src/domain/dates.mjs
var uid = () =>
  `mp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
var dayKey = (value = Date.now()) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
var validDay = (s) =>
  typeof s === "string" &&
  /^20\d{2}-\d{2}-\d{2}$/.test(s) &&
  dayKey(/* @__PURE__ */ new Date(`${s}T12:00:00`)) === s;
var addDays = (s, n) => {
  const d = /* @__PURE__ */ new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
//#endregion
//#region ../src/domain/settings.mjs
var DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  dailyGoal: 120,
  notifications: true,
  sound: true,
  closeToTray: true,
};
function settingsInput(input) {
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, min, max] of [
    ["focusMinutes", 1, 180],
    ["shortMinutes", 1, 60],
    ["longMinutes", 1, 120],
    ["dailyGoal", 1, 1440],
  ]) {
    const n = Number(input[key]);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`${key} 超出有效范围 ${min}–${max}`);
    result[key] = n;
  }
  for (const key of ["notifications", "sound", "closeToTray"])
    result[key] = !!input[key];
  return result;
}
//#endregion
//#region ../src/domain/text.mjs
var text = (v, max = 300) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
//#endregion
//#region ../src/domain/tasks.mjs
var QUADRANTS = [
  {
    id: "do",
    title: "立即行动",
    subtitle: "重要且紧急",
    color: "#b45646",
  },
  {
    id: "plan",
    title: "专注规划",
    subtitle: "重要不紧急",
    color: "#74846b",
  },
  {
    id: "delegate",
    title: "高效处理",
    subtitle: "紧急不重要",
    color: "#bb9254",
  },
  {
    id: "later",
    title: "留待以后",
    subtitle: "不重要不紧急",
    color: "#8d879e",
  },
];
function taskInput(input, existing = {}) {
  const title = text(input.title);
  if (!title) throw new Error("请填写任务名称");
  if (!QUADRANTS.some((q) => q.id === input.quadrant))
    throw new Error("请选择任务象限");
  const due = input.due || "";
  if (due && !validDay(due)) throw new Error("截止日期无效");
  const dueTime = input.dueTime || "";
  if (dueTime && (!due || !/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)))
    throw new Error("请先选择截止日期，并填写有效截止时间");
  const reminder = input.reminder || "";
  if (
    reminder &&
    (!/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(reminder) ||
      !validDay(reminder.slice(0, 10)) ||
      !Number.isFinite(Date.parse(reminder)))
  )
    throw new Error("提醒时间无效");
  const estimate = Number(input.estimate || 0);
  if (!Number.isFinite(estimate) || estimate < 0 || estimate > 1e4)
    throw new Error("预计时间应为 0–10000 分钟");
  const subtasks = (Array.isArray(input.subtasks) ? input.subtasks : [])
    .slice(0, 100)
    .map((s) => ({
      id: text(s.id) || uid(),
      title: text(s.title),
      done: !!s.done,
    }))
    .filter((s) => s.title);
  return {
    id: existing.id || uid(),
    title,
    quadrant: input.quadrant,
    project: text(input.project, 60) || "收集箱",
    due,
    dueTime,
    reminder,
    repeat: ["daily", "weekly"].includes(input.repeat) ? input.repeat : "none",
    estimate,
    notes: text(input.notes, 1e4),
    subtasks,
    createdAt: existing.createdAt || Date.now(),
    completedAt: existing.completedAt || null,
    deletedAt: existing.deletedAt || null,
    remindedFor:
      reminder === existing.reminder ? existing.remindedFor || "" : "",
  };
}
function completeTask(state, id, now = Date.now()) {
  const task = state.tasks.find((t) => t.id === id && !t.deletedAt);
  if (!task) throw new Error("任务不存在");
  if (task.completedAt) {
    task.completedAt = null;
    return;
  }
  task.completedAt = now;
  if (task.repeat === "none") return;
  const step = task.repeat === "daily" ? 1 : 7;
  let due = task.due || dayKey(now);
  do due = addDays(due, step);
  while (due <= dayKey(now));
  const next = taskInput({
    ...task,
    due,
    reminder: task.reminder ? `${due}T${task.reminder.slice(11)}` : "",
    subtasks: task.subtasks.map((s) => ({
      ...s,
      done: false,
    })),
  });
  next.repeatParent = task.id;
  if (!state.tasks.some((t) => t.repeatParent === task.id))
    state.tasks.push(next);
}
//#endregion
//#region ../src/domain/timer.mjs
function emptyTimer(settings = DEFAULT_SETTINGS, mode = "focus") {
  return {
    mode,
    status: "idle",
    taskId: "",
    taskTitle: "",
    project: "未分类",
    targetMs:
      (mode === "focus"
        ? settings.focusMinutes
        : mode === "short"
          ? settings.shortMinutes
          : mode === "long"
            ? settings.longMinutes
            : 0) * 6e4,
    startedAt: null,
    activeSince: null,
    checkpointAt: null,
    segments: [],
  };
}
function elapsed(timer, now = Date.now()) {
  return (
    timer.segments.reduce((n, s) => n + Math.max(0, s.end - s.start), 0) +
    (timer.status === "running" ? Math.max(0, now - timer.activeSince) : 0)
  );
}
function seal(timer, now) {
  if (timer.status === "running" && now > timer.activeSince)
    timer.segments.push({
      start: timer.activeSince,
      end: now,
    });
  timer.activeSince = null;
}
function finishTimer(state, now = Date.now(), completed = false) {
  const t = state.timer;
  if (t.status === "idle") return;
  let end = now;
  if (completed && t.status === "running" && t.targetMs)
    end =
      t.activeSince +
      Math.max(
        0,
        t.targetMs -
          elapsed(
            {
              ...t,
              status: "paused",
            },
            now,
          ),
      );
  seal(t, end);
  t.status = "paused";
  const total = t.segments.reduce((n, s) => n + s.end - s.start, 0);
  if (["focus", "stopwatch"].includes(t.mode) && total >= 1e3)
    state.logs.push({
      id: uid(),
      taskId: t.taskId,
      title: t.taskTitle || "自由专注",
      project: t.project,
      mode: t.mode,
      startedAt: t.startedAt,
      endedAt: end,
      durationMs: total,
      completed,
      segments: t.segments,
      deletedAt: null,
    });
  if (completed && t.mode === "focus") state.cycles++;
  const nextMode =
    completed && t.mode === "focus"
      ? state.cycles % 4 === 0
        ? "long"
        : "short"
      : completed && ["short", "long"].includes(t.mode)
        ? "focus"
        : t.mode;
  state.timer = emptyTimer(state.settings, nextMode);
  return {
    completed,
    mode: t.mode,
    durationMs: total,
    nextMode,
  };
}
function timerAction(state, action, payload = {}, now = Date.now()) {
  const t = state.timer;
  if (action === "start") {
    if (t.status === "running") return;
    if (t.status === "idle") {
      const mode = ["focus", "short", "long", "stopwatch"].includes(
        payload.mode,
      )
        ? payload.mode
        : t.mode;
      state.timer = emptyTimer(state.settings, mode);
      if (payload.durationMinutes !== void 0 && mode !== "stopwatch") {
        const minutes = Number(payload.durationMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180)
          throw new Error("本次时长应为 1–180 分钟的整数");
        state.timer.targetMs = minutes * 6e4;
      }
      const task = state.tasks.find(
        (x) => x.id === payload.taskId && !x.deletedAt && !x.completedAt,
      );
      Object.assign(state.timer, {
        taskId: (task === null || task === void 0 ? void 0 : task.id) || "",
        taskTitle:
          (task === null || task === void 0 ? void 0 : task.title) || "",
        project:
          (task === null || task === void 0 ? void 0 : task.project) ||
          "未分类",
        startedAt: now,
      });
    }
    Object.assign(state.timer, {
      status: "running",
      activeSince: now,
      checkpointAt: now,
    });
  } else if (action === "pause") {
    if (t.status === "running") {
      seal(t, now);
      t.status = "paused";
      t.checkpointAt = now;
    }
  } else if (action === "finish") return finishTimer(state, now, false);
  else if (action === "reset") state.timer = emptyTimer(state.settings, t.mode);
  else throw new Error("不支持的计时操作");
}
function tickTimer(state, now = Date.now()) {
  if (state.timer.status !== "running") return null;
  state.timer.checkpointAt = now;
  if (state.timer.targetMs && elapsed(state.timer, now) >= state.timer.targetMs)
    return finishTimer(state, now, true);
  return null;
}
//#endregion
//#region ../src/themes/catalog.mjs
var THEMES = [
  {
    id: "monument",
    name: "鎏金殿堂",
    subtitle: "石材、黄铜与对称柱廊",
    description: "保留 V1.1 的纪念性建筑风格。",
    colors: ["#302c25", "#b99b62", "#f1ebdf"],
    background: "#eee8dc",
    architecture: true,
  },
  {
    id: "paper",
    name: "晴日纸间",
    subtitle: "留白、鼠尾草绿与柔和纸面",
    description: "轻盈、清晰，适合日常学习与长时间阅读。",
    colors: ["#edf2ed", "#52705e", "#ffffff"],
    background: "#f6f8f5",
    architecture: false,
  },
  {
    id: "midnight",
    name: "午夜星图",
    subtitle: "深蓝、雾紫与低亮度工作空间",
    description: "为晚间专注保留安静的层次。",
    colors: ["#141c2b", "#aeb7ff", "#242f43"],
    background: "#141c2b",
    architecture: false,
  },
  {
    id: "violet",
    name: "紫雾花园",
    subtitle: "鸢尾紫、月光与层叠山影",
    description: "柔和的紫色系，配以原创月夜彩绘。",
    colors: ["#e8def7", "#7656a8", "#fbf8ff"],
    background: "#f0e9fa",
    architecture: false,
  },
  {
    id: "orbital",
    name: "轨道时代",
    subtitle: "冷战年代 · 构成主义与太空图谱",
    description: "砖红、石蓝与奶油纸，取材于太空时代设计语言。",
    colors: ["#203943", "#b64732", "#f7eed8"],
    background: "#e8dfc9",
    architecture: false,
  },
  {
    id: "millennium",
    name: "千禧漫游",
    subtitle: "2000 · 液态银、青蓝与糖果粉",
    description: "铬色光泽、像素网格与透明气泡组成千禧图画。",
    colors: ["#dbe8f6", "#346ad4", "#f8fcff"],
    background: "#e8f0fb",
    architecture: false,
  },
  {
    id: "coast",
    name: "海盐来信",
    subtitle: "海岸蓝、杏色与日落剪影",
    description: "清透的海边配色，配以几何彩绘海湾。",
    colors: ["#d8eae8", "#267c88", "#fffdf5"],
    background: "#edf3ee",
    architecture: false,
  },
  {
    id: "medical",
    name: "经典医疗",
    subtitle: "白、医用蓝与青绿",
    description: "清晰、明亮的临床工作空间。",
    colors: ["#f3f8fb", "#086b91", "#16877a"],
    background: "#f3f8fb",
    architecture: false,
  },
];
//#endregion
//#region ../src/themes/custom.mjs
var ASSET_ID = /^[a-f0-9]{64}\.png$/;
var hex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
var defaultAppearance = () => ({
  image: "default",
  opacity: 22,
  blur: 0,
  position: "center",
  fit: "cover",
});
function appearanceInput(value = {}) {
  const a = {
    ...defaultAppearance(),
    ...value,
  };
  if (!["default", "none"].includes(a.image) && !ASSET_ID.test(a.image))
    throw Error("背景图标识无效");
  if (
    !Number.isFinite(a.opacity) ||
    a.opacity < 0 ||
    a.opacity > 60 ||
    !Number.isFinite(a.blur) ||
    a.blur < 0 ||
    a.blur > 16 ||
    !["center", "top", "bottom", "left", "right"].includes(a.position) ||
    !["cover", "contain"].includes(a.fit)
  )
    throw Error("背景图设置无效");
  return Object.fromEntries(
    Object.keys(defaultAppearance()).map((k) => [k, a[k]]),
  );
}
function customThemesInput(items = []) {
  if (!Array.isArray(items) || items.length > 30)
    throw Error("最多保存30个自定义主题");
  const ids = /* @__PURE__ */ new Set();
  return items.map((x) => {
    if (
      !/^custom-[a-z0-9-]{5,64}$/.test(x.id) ||
      ids.has(x.id) ||
      typeof x.name !== "string" ||
      !x.name.trim() ||
      x.name.length > 40 ||
      !THEMES.some((t) => t.id === x.base)
    )
      throw Error("自定义主题名称或标识无效");
    ids.add(x.id);
    if (
      !x.colors ||
      !["accent", "background", "surface", "text"].every((k) =>
        hex(x.colors[k]),
      )
    )
      throw Error("主题颜色必须是六位十六进制颜色");
    return {
      id: x.id,
      name: x.name.trim(),
      base: x.base,
      colors: Object.fromEntries(
        ["accent", "background", "surface", "text"].map((k) => [
          k,
          x.colors[k],
        ]),
      ),
      appearance: appearanceInput(x.appearance),
      deletedAt: Number.isFinite(x.deletedAt) ? x.deletedAt : null,
    };
  });
}
//#endregion
//#region ../src/platform/model.mjs
var DEFAULT_WIDGET_ORDER = ["priority", "focus", "week", "courses"];
var validId = (id) =>
  typeof id === "string" &&
  /^[a-z][a-z0-9-]{1,47}$/.test(id) &&
  !["constructor", "prototype"].includes(id);
function initialWorkspace() {
  return {
    version: 1,
    theme: "monument",
    appearance: defaultAppearance(),
    customThemes: [],
    widgets: {
      order: [...DEFAULT_WIDGET_ORDER],
      hidden: [],
      sizes: {},
    },
    navigation: {
      collapsed: false,
      hidden: [],
    },
    onboardingVersion: 0,
    widgetData: {},
  };
}
function idList(input) {
  if (
    !Array.isArray(input) ||
    input.length > 100 ||
    input.some((x) => !validId(x))
  )
    throw new Error("小组件列表无效");
  return [...new Set(input)];
}
function safeWidgetData(value) {
  const encoded = JSON.stringify(value);
  if (!encoded || encoded.length > 2e4) throw new Error("小组件数据过大或无效");
  const visit = (v, depth = 0) => {
    if (depth > 12) throw new Error("小组件数据层级过深");
    if (v === null || typeof v === "string" || typeof v === "boolean") return;
    if (typeof v === "number" && Number.isFinite(v)) return;
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    if (
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    ) {
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(k))
          throw new Error("小组件字段无效");
        visit(x, depth + 1);
      }
      return;
    }
    throw new Error("小组件数据必须是 JSON");
  };
  visit(value);
  return JSON.parse(encoded);
}
function workspaceInput(input) {
  if (input === void 0) return initialWorkspace();
  if (!input || input.version !== 1) throw new Error("工作台配置版本不支持");
  const result = initialWorkspace();
  result.appearance = appearanceInput(input.appearance);
  result.customThemes = customThemesInput(input.customThemes);
  result.theme =
    THEMES.some((t) => t.id === input.theme) ||
    result.customThemes.some((t) => t.id === input.theme && !t.deletedAt)
      ? input.theme
      : "monument";
  if (input.widgets) {
    var _input$widgets$order, _input$widgets$hidden, _input$widgets$sizes;
    result.widgets.order = idList(
      (_input$widgets$order = input.widgets.order) !== null &&
        _input$widgets$order !== void 0
        ? _input$widgets$order
        : DEFAULT_WIDGET_ORDER,
    );
    result.widgets.hidden = idList(
      (_input$widgets$hidden = input.widgets.hidden) !== null &&
        _input$widgets$hidden !== void 0
        ? _input$widgets$hidden
        : [],
    );
    const sizes =
      (_input$widgets$sizes = input.widgets.sizes) !== null &&
      _input$widgets$sizes !== void 0
        ? _input$widgets$sizes
        : {};
    if (
      !sizes ||
      typeof sizes !== "object" ||
      Array.isArray(sizes) ||
      Object.keys(sizes).length > 100
    )
      throw new Error("小组件尺寸无效");
    for (const [id, size] of Object.entries(sizes)) {
      if (!validId(id) || !["half", "full"].includes(size))
        throw new Error("小组件尺寸无效");
      result.widgets.sizes[id] = size;
    }
  }
  if (input.navigation) {
    var _input$navigation$hid;
    if (typeof input.navigation.collapsed !== "boolean")
      throw new Error("侧栏配置无效");
    result.navigation = {
      collapsed: input.navigation.collapsed,
      hidden: idList(
        (_input$navigation$hid = input.navigation.hidden) !== null &&
          _input$navigation$hid !== void 0
          ? _input$navigation$hid
          : [],
      ),
    };
  }
  if (input.onboardingVersion !== void 0) {
    if (
      !Number.isInteger(input.onboardingVersion) ||
      input.onboardingVersion < 0 ||
      input.onboardingVersion > 100
    )
      throw new Error("新手引导版本无效");
    result.onboardingVersion = input.onboardingVersion;
  }
  if (input.widgetData) {
    if (
      typeof input.widgetData !== "object" ||
      Array.isArray(input.widgetData) ||
      Object.keys(input.widgetData).length > 100
    )
      throw new Error("小组件存储无效");
    for (const [id, record] of Object.entries(input.widgetData)) {
      if (
        !validId(id) ||
        !Number.isInteger(
          record === null || record === void 0 ? void 0 : record.version,
        ) ||
        record.version < 1 ||
        record.version > 1e3
      )
        throw new Error("小组件存储版本无效");
      result.widgetData[id] = {
        version: record.version,
        data: safeWidgetData(record.data),
      };
    }
  }
  if (JSON.stringify(result).length > 25e4) throw new Error("工作台配置过大");
  return result;
}
function updateWorkspace(current, patch) {
  const next = JSON.parse(JSON.stringify(current));
  if (patch.customThemes !== void 0)
    next.customThemes = customThemesInput(patch.customThemes);
  if (patch.appearance !== void 0)
    next.appearance = appearanceInput({
      ...next.appearance,
      ...patch.appearance,
    });
  if (patch.theme !== void 0) {
    if (
      !THEMES.some((t) => t.id === patch.theme) &&
      !next.customThemes.some((t) => t.id === patch.theme && !t.deletedAt)
    )
      throw new Error("主题不存在");
    next.theme = patch.theme;
  }
  if (patch.widgets !== void 0)
    next.widgets = {
      ...next.widgets,
      ...patch.widgets,
    };
  if (patch.navigation !== void 0)
    next.navigation = {
      ...next.navigation,
      ...patch.navigation,
    };
  if (patch.onboardingVersion !== void 0)
    next.onboardingVersion = patch.onboardingVersion;
  return workspaceInput(next);
}
var migrations = {
  4: (data) => ({
    ...data,
    schemaVersion: 5,
    events: (data.events || []).map((e) => ({
      ...e,
      allDay: !!e.allDay,
      calendarUid: e.calendarUid || "",
    })),
  }),
  1: (data) => ({
    ...data,
    schemaVersion: 2,
    tasks: Array.isArray(data.tasks)
      ? data.tasks.map((task) => ({
          ...task,
          dueTime: task.dueTime || "",
        }))
      : data.tasks,
  }),
  2: (data) => {
    var _data$workspace;
    return {
      ...data,
      schemaVersion: 3,
      workspace:
        (_data$workspace = data.workspace) !== null &&
        _data$workspace !== void 0
          ? _data$workspace
          : initialWorkspace(),
    };
  },
  3: (data) => {
    var _data$lists, _data$events, _data$courseTrash;
    return {
      ...data,
      schemaVersion: 4,
      lists:
        (_data$lists = data.lists) !== null && _data$lists !== void 0
          ? _data$lists
          : [],
      events:
        (_data$events = data.events) !== null && _data$events !== void 0
          ? _data$events
          : [],
      courseTrash:
        (_data$courseTrash = data.courseTrash) !== null &&
        _data$courseTrash !== void 0
          ? _data$courseTrash
          : [],
    };
  },
};
function migrateData(input) {
  if (
    !input ||
    !Number.isInteger(input.schemaVersion) ||
    input.schemaVersion < 1
  )
    throw new Error("备份格式或版本不支持");
  if (input.schemaVersion > 5) {
    const error = /* @__PURE__ */ new Error(
      "数据来自更新版本，请使用更新的 VERITAS 打开；原数据未改动。",
    );
    error.code = "NEWER_DATA_VERSION";
    throw error;
  }
  let data = JSON.parse(JSON.stringify(input));
  while (data.schemaVersion < 5) {
    const migrate = migrations[data.schemaVersion];
    if (!migrate) throw new Error("缺少数据升级步骤，原数据未改动");
    data = migrate(data);
  }
  return data;
}
//#endregion
//#region ../src/domain/content.mjs
var courseKey = (c) => {
  var _c$ids, _c$ids2;
  return JSON.stringify([
    String(
      ((_c$ids = c.ids) === null || _c$ids === void 0 ? void 0 : _c$ids.CSID) ||
        "",
    ),
    String(
      ((_c$ids2 = c.ids) === null || _c$ids2 === void 0
        ? void 0
        : _c$ids2.MCSID) || "",
    ),
    c.title,
    c.start,
  ]);
};
var visibleCourses = (state) => {
  const hidden = new Set(
    (state.courseTrash || []).filter((x) => x.deletedAt).map((x) => x.key),
  );
  return (state.courses || []).filter((c) => !hidden.has(courseKey(c)));
};
function eventInput(p, old = {}) {
  const title = text(p.title),
    start = text(p.start, 30),
    end = text(p.end, 30);
  const valid = (value) =>
    /^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) &&
    validDay(value.slice(0, 10));
  if (!title) throw Error("请填写日程标题");
  if (!valid(start) || !valid(end) || end <= start)
    throw Error("结束时间必须晚于开始时间");
  if (p.allDay && (!start.endsWith("T00:00") || !end.endsWith("T00:00")))
    throw Error("全天日程须从零点开始，到结束日期后的零点结束");
  if (Date.parse(end + "+08:00") - Date.parse(start + "+08:00") > 316224e5)
    throw Error("单条日程不能超过一年");
  return {
    id: old.id || uid(),
    title,
    start,
    end,
    location: text(p.location, 200),
    notes: text(p.notes, 5e3),
    allDay: !!p.allDay,
    calendarUid: text(old.calendarUid || p.calendarUid, 600),
    createdAt: old.createdAt || Date.now(),
    deletedAt: old.deletedAt || null,
  };
}
function contentInput(raw, state) {
  var _raw$lists;
  const lists =
    (_raw$lists = raw.lists) !== null && _raw$lists !== void 0
      ? _raw$lists
      : [];
  if (!Array.isArray(lists) || lists.length > 2e3) throw Error("清单数据无效");
  const names = /* @__PURE__ */ new Set(),
    listIds = /* @__PURE__ */ new Set();
  state.lists = lists.map((x) => {
    const name = text(x.name, 60);
    if (
      !name ||
      names.has(name) ||
      typeof x.id !== "string" ||
      !x.id ||
      x.id.length > 100 ||
      listIds.has(x.id) ||
      (x.deletedAt != null && !Number.isFinite(x.deletedAt))
    )
      throw Error("清单名称或标识无效");
    names.add(name);
    listIds.add(x.id);
    return {
      id: x.id,
      name,
      deletedAt: x.deletedAt || null,
    };
  });
  ensureLists(state);
  if (
    raw.events !== void 0 &&
    (!Array.isArray(raw.events) || raw.events.length > 2e4)
  )
    throw Error("日程数据无效");
  const ids = /* @__PURE__ */ new Set();
  state.events = (raw.events || []).map((x) => {
    if (
      typeof x.id !== "string" ||
      !x.id ||
      x.id.length > 100 ||
      ids.has(x.id) ||
      !Number.isFinite(x.createdAt) ||
      x.createdAt < 0 ||
      (x.deletedAt != null && !Number.isFinite(x.deletedAt))
    )
      throw Error("日程标识无效");
    ids.add(x.id);
    return eventInput(x, x);
  });
  if (
    raw.courseTrash !== void 0 &&
    (!Array.isArray(raw.courseTrash) || raw.courseTrash.length > 2e4)
  )
    throw Error("课程回收站无效");
  state.courseTrash = (raw.courseTrash || []).map((x) => {
    if (
      !x.course ||
      typeof x.course.title !== "string" ||
      typeof x.course.start !== "string" ||
      typeof x.course.end !== "string" ||
      !validDay(x.course.start.slice(0, 10)) ||
      !validDay(x.course.end.slice(0, 10)) ||
      x.course.end <= x.course.start ||
      typeof x.key !== "string" ||
      x.key !== courseKey(x.course) ||
      !Number.isFinite(x.deletedAt)
    )
      throw Error("课程回收站内容无效");
    return {
      key: x.key,
      course: x.course,
      deletedAt: x.deletedAt,
    };
  });
}
function ensureLists(state) {
  for (const name of /* @__PURE__ */ new Set([
    "收集箱",
    ...state.tasks.filter((x) => !x.deletedAt).map((x) => x.project),
  ])) {
    const list = state.lists.find((x) => x.name === name);
    if (list) list.deletedAt = null;
    else
      state.lists.push({
        id: uid(),
        name,
        deletedAt: null,
      });
  }
}
//#endregion
//#region ../src/domain/state.mjs
function initialState() {
  return {
    schemaVersion: 5,
    workspace: initialWorkspace(),
    tasks: [],
    lists: [
      {
        id: "list:收集箱",
        name: "收集箱",
        deletedAt: null,
      },
    ],
    events: [],
    courseTrash: [],
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
    timer: emptyTimer(),
    cycles: 0,
    courses: [],
    courseRanges: [],
    scores: null,
    lastNotice: "",
  };
}
function validateState(raw) {
  raw = migrateData(raw);
  if (
    !raw ||
    raw.schemaVersion !== 5 ||
    !Array.isArray(raw.tasks) ||
    !Array.isArray(raw.logs) ||
    raw.tasks.length > 5e4 ||
    raw.logs.length > 1e5
  )
    throw new Error("备份格式或版本不支持");
  const state = initialState();
  state.workspace = workspaceInput(raw.workspace);
  state.settings = settingsInput(raw.settings || {});
  const ids = /* @__PURE__ */ new Set();
  state.tasks = raw.tasks.map((t) => {
    if (
      !t ||
      typeof t.id !== "string" ||
      !t.id ||
      t.id.length > 100 ||
      ids.has(t.id) ||
      !Number.isFinite(t.createdAt) ||
      t.createdAt < 0 ||
      (t.completedAt != null && !Number.isFinite(t.completedAt)) ||
      (t.deletedAt != null && !Number.isFinite(t.deletedAt))
    )
      throw new Error("任务标识或时间字段无效");
    ids.add(t.id);
    return {
      ...taskInput(t, t),
      repeatParent: text(t.repeatParent),
      remindedFor: text(t.remindedFor),
    };
  });
  const logIds = /* @__PURE__ */ new Set();
  state.logs = raw.logs.map((l) => {
    var _l$segments$, _l$segments$slice$;
    if (
      !l ||
      typeof l.id !== "string" ||
      !l.id ||
      logIds.has(l.id) ||
      !Array.isArray(l.segments) ||
      !l.segments.length ||
      l.segments.length > 1e4
    )
      throw new Error("工作记录损坏");
    logIds.add(l.id);
    let previous = 0;
    for (const s of l.segments) {
      if (
        !Number.isFinite(s.start) ||
        !Number.isFinite(s.end) ||
        s.start < 0 ||
        s.end <= s.start ||
        s.end - s.start > 316224e5 ||
        s.start < previous
      )
        throw new Error("工作区间无效");
      previous = s.end;
    }
    return {
      id: text(l.id),
      taskId: text(l.taskId),
      title: text(l.title),
      project: text(l.project),
      mode: ["focus", "stopwatch", "manual"].includes(l.mode)
        ? l.mode
        : "manual",
      startedAt:
        ((_l$segments$ = l.segments[0]) === null || _l$segments$ === void 0
          ? void 0
          : _l$segments$.start) || 0,
      endedAt:
        ((_l$segments$slice$ = l.segments.slice(-1)[0]) === null ||
        _l$segments$slice$ === void 0
          ? void 0
          : _l$segments$slice$.end) || 0,
      durationMs: l.segments.reduce((n, s) => n + s.end - s.start, 0),
      completed: !!l.completed,
      segments: l.segments.map((s) => ({
        start: s.start,
        end: s.end,
      })),
      deletedAt: l.deletedAt || null,
    };
  });
  if (
    raw.timer &&
    ["idle", "paused", "running"].includes(raw.timer.status) &&
    ["focus", "short", "long", "stopwatch"].includes(raw.timer.mode)
  ) {
    const t = raw.timer;
    if (
      !Array.isArray(t.segments) ||
      t.segments.length > 1e4 ||
      t.segments.some(
        (s) =>
          !Number.isFinite(s.start) ||
          !Number.isFinite(s.end) ||
          s.end < s.start ||
          s.start < 0 ||
          s.end - s.start > 316224e5,
      ) ||
      !Number.isFinite(t.targetMs) ||
      t.targetMs < 0 ||
      t.targetMs > 108e5 ||
      (t.status === "running" &&
        (!Number.isFinite(t.activeSince) || !Number.isFinite(t.checkpointAt)))
    )
      throw new Error("计时器状态损坏");
    state.timer = {
      mode: t.mode,
      status: t.status,
      taskId: text(t.taskId),
      taskTitle: text(t.taskTitle),
      project: text(t.project) || "未分类",
      targetMs: t.targetMs,
      startedAt: Number.isFinite(t.startedAt) ? t.startedAt : null,
      activeSince: t.status === "running" ? t.activeSince : null,
      checkpointAt: Number.isFinite(t.checkpointAt) ? t.checkpointAt : null,
      segments: t.segments.map((s) => ({
        start: s.start,
        end: s.end,
      })),
    };
  }
  state.cycles =
    Number.isSafeInteger(raw.cycles) && raw.cycles >= 0 ? raw.cycles : 0;
  state.courses = Array.isArray(raw.courses)
    ? raw.courses
        .filter(
          (c) =>
            c &&
            typeof c.title === "string" &&
            typeof c.start === "string" &&
            validDay(c.start.slice(0, 10)) &&
            typeof c.end === "string" &&
            c.end > c.start,
        )
        .map((c) => ({
          title: text(c.title),
          start: text(c.start, 40),
          end: text(c.end, 40),
          location: text(c.location),
          teacher: text(c.teacher),
          type: text(c.type),
          ids: Object.fromEntries(
            ["MCSID", "CSID", "CurriculumID", "XXKMID", "CurriculumType"].map(
              (k) => {
                var _c$ids$k, _c$ids;
                return [
                  k,
                  text(
                    String(
                      (_c$ids$k =
                        (_c$ids = c.ids) === null || _c$ids === void 0
                          ? void 0
                          : _c$ids[k]) !== null && _c$ids$k !== void 0
                        ? _c$ids$k
                        : "",
                    ),
                    100,
                  ),
                ];
              },
            ),
          ),
        }))
    : [];
  state.courseRanges = Array.isArray(raw.courseRanges)
    ? raw.courseRanges.filter(
        (r) =>
          validDay(r.start) && validDay(r.end) && Number.isFinite(r.syncedAt),
      )
    : [];
  state.scores =
    raw.scores && Array.isArray(raw.scores.items)
      ? {
          year: text(raw.scores.year),
          semester: Number(raw.scores.semester) || 1,
          syncedAt: Number(raw.scores.syncedAt) || 0,
          years: Array.isArray(raw.scores.years)
            ? raw.scores.years.map((y) => text(y))
            : [],
          gpa: text(raw.scores.gpa, 2e3),
          items: raw.scores.items
            .filter((x) => x && typeof x === "object")
            .map((x) =>
              Object.fromEntries(
                [
                  "title",
                  "score",
                  "finalScore",
                  "grade",
                  "credit",
                  "situation",
                ].map((k) => {
                  var _x$k;
                  return [
                    k,
                    text(
                      String(
                        (_x$k = x[k]) !== null && _x$k !== void 0 ? _x$k : "",
                      ),
                    ),
                  ];
                }),
              ),
            ),
        }
      : null;
  state.lastNotice = text(raw.lastNotice, 2e3);
  contentInput(raw, state);
  return state;
}
//#endregion
//#region ../src/cloud-data.mjs
var CLOUD_KEYS = [
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
function cloudDocument(state) {
  const validated = validateState(state);
  return Object.fromEntries(CLOUD_KEYS.map((key) => [key, validated[key]]));
}
function validateCloudDocument(document) {
  if (
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    Object.keys(document).some((key) => !CLOUD_KEYS.includes(key)) ||
    CLOUD_KEYS.some((key) => !(key in document))
  )
    throw Error("云端数据格式无效");
  if (
    encodeURIComponent(JSON.stringify(document)).replace(/%[0-9A-F]{2}/g, "x")
      .length > 819200
  )
    throw Error("同步数据超过800KB，请导出备份并联系开发者扩容");
  return cloudDocument({
    ...initialState(),
    ...document,
  });
}
//#endregion
//#region ../src/briefing.mjs
var beijingDay = (value = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
//#endregion
//#region ../src/calendar.mjs
var DAY = 864e5;
var key = (date) => date.toISOString().slice(0, 10);
var utc = (day) => Date.parse(`${day}T12:00:00Z`);
function calendarDate(day) {
  return (
    typeof day === "string" &&
    /^20\d{2}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(utc(day)) &&
    key(new Date(utc(day))) === day
  );
}
var time = (value) => {
  if (!value) return NaN;
  const s = value.replace(" ", "T");
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : s + "+08:00");
};
var clock = (ms) => new Date(ms + 288e5).toISOString().slice(11, 16);
function calendarEvents(
  state,
  { showCompleted = true, showTasks = true, showCourses = true } = {},
) {
  const result = [];
  if (showTasks)
    for (const task of state.tasks || []) {
      if (
        task.deletedAt ||
        (!showCompleted && task.completedAt) ||
        !calendarDate(task.due)
      )
        continue;
      const start = Date.parse(
        `${task.due}T${task.dueTime || "23:59"}:00+08:00`,
      );
      if (!Number.isFinite(start)) continue;
      result.push({
        id: `task:${task.id}`,
        kind: "task",
        title: task.title,
        day: task.due,
        lastDay: task.due,
        start,
        end: start,
        clock: task.dueTime || "当天截止",
        allDay: !task.dueTime,
        completed: !!task.completedAt,
        detail: task.project || "收集箱",
        task,
      });
    }
  if (showCourses)
    for (const [i, course] of visibleCourses(state).entries()) {
      const start = time(course.start),
        end = time(course.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        continue;
      result.push({
        id: `course:${i}:${course.start}`,
        kind: "course",
        title: course.title,
        day: beijingDay(start),
        lastDay: beijingDay(end - 1),
        start,
        end,
        clock: `${clock(start)}–${clock(end)}`,
        allDay: false,
        completed: false,
        detail: [course.location, course.teacher].filter(Boolean).join(" · "),
        course,
      });
    }
  for (const event of state.events || []) {
    if (event.deletedAt) continue;
    const start = time(event.start),
      end = time(event.end);
    result.push({
      id: `event:${event.id}`,
      kind: "event",
      title: event.title,
      day: beijingDay(start),
      lastDay: beijingDay(end - 1),
      start,
      end,
      clock: event.allDay ? "全天" : `${clock(start)}–${clock(end)}`,
      allDay: !!event.allDay,
      completed: false,
      detail: event.location,
      event,
    });
  }
  return result.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}
function eventsOnDay(events, day) {
  return events.filter((e) => e.day <= day && e.lastDay >= day);
}
function courseCoverage(state, day, now = Date.now()) {
  const ranges = (state.courseRanges || []).filter(
    (r) => r.start <= day && r.end > day && Number.isFinite(r.syncedAt),
  );
  const syncedAt = Math.max(0, ...ranges.map((r) => r.syncedAt));
  return {
    status: !ranges.length
      ? "missing"
      : syncedAt <= now && now - syncedAt <= 7 * DAY
        ? "fresh"
        : "stale",
    syncedAt,
  };
}
//#endregion
exports.QUADRANTS = QUADRANTS;
exports.THEMES = THEMES;
exports.addDays = addDays;
exports.calendarEvents = calendarEvents;
exports.cloudDocument = cloudDocument;
exports.completeTask = completeTask;
exports.courseCoverage = courseCoverage;
exports.dayKey = dayKey;
exports.elapsed = elapsed;
exports.emptyTimer = emptyTimer;
exports.eventInput = eventInput;
exports.eventsOnDay = eventsOnDay;
exports.initialState = initialState;
exports.taskInput = taskInput;
exports.tickTimer = tickTimer;
exports.timerAction = timerAction;
exports.updateWorkspace = updateWorkspace;
exports.validateCloudDocument = validateCloudDocument;
exports.validateState = validateState;
