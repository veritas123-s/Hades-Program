import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  initialState,
  taskInput,
  completeTask,
  timerAction,
  tickTimer,
  recoverTimer,
  elapsed,
  dayTotals,
  dayKey,
  validateState,
  csvLogs,
  settingsInput,
  validDay,
} from "../src/domain.mjs";
import { parseCourses, parseScores, isSchoolURL } from "../electron/campus.mjs";
import { Store } from "../electron/store.mjs";

test("任务校验、子任务与优先级", () => {
  const t = taskInput({
    title: "  复习  ",
    quadrant: "plan",
    subtasks: [{ title: "读一节" }, { title: "" }],
  });
  assert.equal(t.title, "复习");
  assert.equal(t.subtasks.length, 1);
  assert.throws(() => taskInput({ title: "", quadrant: "plan" }));
  assert.throws(() => taskInput({ title: "x", quadrant: "wrong" }));
  assert.throws(() =>
    taskInput({ title: "x", quadrant: "do", due: "2026-02-31" }),
  );
});
test("日期校验拒绝自动溢出", () => {
  assert.equal(validDay("2026-02-31"), false);
  assert.equal(validDay("2028-02-29"), true);
});
test("重复任务推进未来日期，并在重开重完成时去重", () => {
  const s = initialState(),
    now = +new Date("2026-09-24T12:00:00");
  s.tasks.push(
    taskInput({
      title: "每日阅读",
      quadrant: "plan",
      due: "2026-09-01",
      repeat: "daily",
      reminder: "2026-09-01T09:00",
      subtasks: [{ title: "阅读", done: true }],
    }),
  );
  const id = s.tasks[0].id;
  completeTask(s, id, now);
  assert.equal(s.tasks[1].due, "2026-09-25");
  assert.equal(s.tasks[1].subtasks[0].done, false);
  assert.equal(s.tasks[1].reminder, "2026-09-25T09:00");
  completeTask(s, id, now);
  completeTask(s, id, now);
  assert.equal(s.tasks.length, 2);
});
test("番茄暂停期间不计时，后台延迟完成截断到目标", () => {
  const s = initialState(),
    start = +new Date("2026-09-24T09:00:00");
  timerAction(s, "start", { mode: "focus" }, start);
  timerAction(s, "pause", {}, start + 600000);
  assert.equal(elapsed(s.timer, start + 3600000), 600000);
  timerAction(s, "start", {}, start + 3600000);
  const done = tickTimer(s, start + 7200000);
  assert.equal(done.completed, true);
  assert.equal(s.logs[0].durationMs, 1500000);
  assert.equal(s.logs[0].endedAt, start + 4500000);
  assert.equal(s.logs[0].segments.length, 2);
  assert.equal(s.timer.mode, "short");
  assert.equal(s.timer.status, "idle");
});
test("正计时可保存部分记录，休息不进入工作统计", () => {
  const s = initialState();
  timerAction(s, "start", { mode: "stopwatch" }, 1000);
  timerAction(s, "finish", {}, 61500);
  assert.equal(s.logs[0].durationMs, 60500);
  timerAction(s, "start", { mode: "short" }, 70000);
  tickTimer(s, 400000);
  assert.equal(s.logs.length, 1);
  assert.equal(s.timer.mode, "focus");
});
test("每四个完整番茄进入长休息，部分计时不增加周期", () => {
  const s = initialState();
  for (let i = 0; i < 4; i++) {
    timerAction(s, "start", { mode: "focus" }, i * 2000000);
    tickTimer(s, i * 2000000 + 1500000);
  }
  assert.equal(s.cycles, 4);
  assert.equal(s.timer.mode, "long");
  timerAction(s, "start", { mode: "focus" }, 10000000);
  timerAction(s, "finish", {}, 10002000);
  assert.equal(s.cycles, 4);
});
test("崩溃恢复到最后保存点，不计算关闭期间", () => {
  const s = initialState();
  timerAction(s, "start", { mode: "focus" }, 10000);
  tickTimer(s, 15000);
  recoverTimer(s);
  assert.equal(s.timer.status, "paused");
  assert.equal(elapsed(s.timer, 999999), 5000);
});
test("双击开始不会重复启动，重复结束不重复记账", () => {
  const s = initialState();
  timerAction(s, "start", { mode: "stopwatch" }, 1000);
  timerAction(s, "start", { mode: "focus" }, 2000);
  assert.equal(s.timer.mode, "stopwatch");
  timerAction(s, "finish", {}, 6000);
  timerAction(s, "finish", {}, 8000);
  assert.equal(s.logs.length, 1);
  assert.equal(s.logs[0].durationMs, 5000);
});
test("跨午夜按真实活动区间分天，不将中途暂停分入统计", () => {
  const start = +new Date("2026-09-24T23:50:00"),
    mid = +new Date("2026-09-25T00:00:00");
  const logs = [
    {
      segments: [
        { start, end: mid + 600000 },
        { start: mid + 1200000, end: mid + 1500000 },
      ],
    },
  ];
  const t = dayTotals(logs);
  assert.equal(t["2026-09-24"], 600000);
  assert.equal(t["2026-09-25"], 900000);
});
test("CSV 转义引号与电子表格公式", () => {
  const csv = csvLogs([
    {
      title: '=HYPERLINK("x")',
      project: "+danger",
      startedAt: 1000,
      endedAt: 3000,
      durationMs: 2000,
      mode: "focus",
    },
  ]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+danger"));
  assert.ok(csv.startsWith("\uFEFF"));
});
test("备份版本、重复任务 ID、非法工作区间校验", () => {
  assert.throws(() => validateState({ schemaVersion: 2 }));
  const s = initialState();
  s.tasks = [taskInput({ title: "test", quadrant: "do" })];
  s.tasks.push(s.tasks[0]);
  assert.throws(() => validateState(s));
  s.tasks = [];
  s.logs = [{ id: "x", segments: [{ start: 2000, end: 1000 }] }];
  assert.throws(() => validateState(s));
});
test("设置拒绝负数和超长番茄", () => {
  assert.throws(() =>
    settingsInput({ ...initialState().settings, focusMinutes: 0 }),
  );
  assert.throws(() =>
    settingsInput({ ...initialState().settings, shortMinutes: 61 }),
  );
});
test("课表沿用上游字段及双尖括号清洗", () => {
  const c = parseCourses({
    List: [
      {
        Curriculum: "<<生物化学>>",
        Start: "2026-09-24T08:00:00",
        End: "2026-09-24T08:40:00",
        Classroom: "A&nbsp;101",
      },
    ],
  })[0];
  assert.equal(c.title, "生物化学");
  assert.equal(c.location, "A 101");
  assert.throws(() => parseCourses("<html>login</html>"));
  assert.throws(() =>
    parseCourses({
      List: [{ Curriculum: "坏时间", Start: "bad", End: "bad" }],
    }),
  );
  assert.deepEqual(parseCourses({ List: [] }), []);
});
test("成绩按上游学期过滤，保留零分及缺失值", () => {
  const r = parseScores(
    {
      1: ["2026-2027"],
      2: [
        [
          { CurriculumName: "A", Semester: 1, Score: 0 },
          { CurriculumName: "B", Semester: 2 },
        ],
      ],
      4: "3.9",
    },
    1,
  );
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].score, "0");
  assert.equal(r.items[0].finalScore, "");
  assert.equal(r.gpa, "3.9");
  assert.throws(() => parseScores({}, 1));
});
test("学校 URL 不允许仿冒域名、凭据 URL 和非 HTTPS", () => {
  assert.equal(isSchoolURL("https://webvpn2.shsmu.edu.cn/test"), true);
  for (const url of [
    "http://shsmu.edu.cn",
    "https://shsmu.edu.cn.evil.com",
    "https://evilshsmu.edu.cn",
    "https://user:pass@shsmu.edu.cn",
    "file:///C:/x",
  ])
    assert.equal(isSchoolURL(url), false);
});
test("原子存储、重启恢复、主文件损坏后备份回退", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-unit-"));
  try {
    const store = new Store(dir);
    store.change((s) =>
      s.tasks.push(taskInput({ title: "keep", quadrant: "plan" })),
    );
    store.change((s) => {
      s.cycles = 1;
    });
    assert.equal(new Store(dir).state.tasks[0].title, "keep");
    fs.writeFileSync(store.file, "broken");
    const recovered = new Store(dir);
    assert.equal(recovered.state.tasks[0].title, "keep");
    assert.match(recovered.state.lastNotice, /备份/);
    assert.ok(fs.readdirSync(dir).some((f) => f.includes("damaged")));
    assert.doesNotThrow(() =>
      JSON.parse(fs.readFileSync(`${store.file}.bak`, "utf8")),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("存储事务验证失败不改变原有状态", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veritas-unit-"));
  try {
    const store = new Store(dir);
    assert.throws(() =>
      store.change((s) => {
        s.cycles = 9;
        throw new Error("invalid");
      }),
    );
    assert.equal(store.state.cycles, 0);
    assert.equal(JSON.parse(fs.readFileSync(store.file)).cycles, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
