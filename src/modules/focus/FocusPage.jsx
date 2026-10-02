import Panel from "../../shared/Panel.jsx";
import React, { useEffect, useState } from "react";
import { Play, Pause, Square, RotateCcw, Leaf } from "lucide-react";
import { elapsed } from "../../domain.mjs";
import { Modal, duration, timeText } from "../../components.jsx";
import QuickLog from "./QuickLog.jsx";
export default function Focus({ state, call, selected, setSelected, todayMs }) {
  const t = state.timer,
    [mode, setMode] = useState(t.mode),
    [confirm, setConfirm] = useState(false),
    [customMinutes, setCustomMinutes] = useState(state.settings.focusMinutes);
  useEffect(() => setMode(t.mode), [t.mode]);
  const active = state.tasks.filter((t) => !t.completedAt && !t.deletedAt),
    ms = elapsed(t),
    target =
      t.status === "idle"
        ? (mode === "focus"
            ? customMinutes
            : mode === "short"
              ? state.settings.shortMinutes
              : mode === "long"
                ? state.settings.longMinutes
                : 0) * 60000
        : t.targetMs;
  const progress = target ? Math.min(1, ms / target) : 0,
    display = t.status === "idle" ? target : target ? target - ms : ms;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>专注空间</h1>
        </div>
      </div>
      <div className="focus-layout">
        <Panel className="focus-stage panel">
          <div className="mode-tabs">
            {[
              ["focus", "番茄专注"],
              ["short", "短休息"],
              ["long", "长休息"],
              ["stopwatch", "正计时"],
            ].map(([id, label]) => (
              <button
                disabled={t.status !== "idle"}
                className={mode === id ? "active" : ""}
                key={id}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="focus-task">
            <span>当前专注于</span>
            <select
              aria-label="当前专注任务"
              disabled={t.status !== "idle"}
              value={t.status === "idle" ? selected : t.taskId}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">自由专注 · 暂不关联任务</option>
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
              {t.taskId && !active.some((a) => a.id === t.taskId) && (
                <option value={t.taskId}>{t.taskTitle}</option>
              )}
            </select>
          </div>
          {mode === "focus" && (
            <div className="duration-picker">
              <label>
                本次专注（分钟）{" "}
                <input
                  aria-label="本次专注分钟"
                  type="number"
                  min="1"
                  max="180"
                  value={customMinutes}
                  disabled={t.status !== "idle"}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
              </label>
              <select
                aria-label="常用专注时长"
                disabled={t.status !== "idle"}
                value={
                  [15, 25, 45, 60, 90].includes(Number(customMinutes))
                    ? customMinutes
                    : "custom"
                }
                onChange={(event) =>
                  event.target.value !== "custom" &&
                  setCustomMinutes(Number(event.target.value))
                }
              >
                <option value="custom">自定义</option>
                {[15, 25, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} 分钟
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="timer-dial">
            <svg viewBox="0 0 320 320">
              <circle className="dial-track" cx="160" cy="160" r="147" />
              <circle
                className="dial-progress"
                cx="160"
                cy="160"
                r="147"
                strokeDasharray={924}
                strokeDashoffset={924 * (1 - progress)}
              />
            </svg>
            <div>
              <span className="timer-label">
                {t.status === "paused"
                  ? "已暂停"
                  : mode === "focus"
                    ? "番茄专注"
                    : mode === "stopwatch"
                      ? "正计时"
                      : "休息"}
              </span>
              <strong data-testid="timer-display">{timeText(display)}</strong>
            </div>
          </div>
          <div className="timer-actions">
            <button
              className="icon-button reset"
              disabled={t.status === "idle"}
              aria-label="重置计时"
              onClick={() => setConfirm(true)}
            >
              <RotateCcw size={20} />
            </button>
            <button
              className="button primary start"
              onClick={() =>
                call("timer", {
                  action: t.status === "running" ? "pause" : "start",
                  mode,
                  ...(mode === "focus"
                    ? { durationMinutes: Number(customMinutes) }
                    : {}),
                  taskId: selected,
                })
              }
            >
              {t.status === "running" ? (
                <Pause size={19} />
              ) : (
                <Play size={19} />
              )}{" "}
              {t.status === "running"
                ? "暂停"
                : t.status === "paused"
                  ? "继续专注"
                  : "开始专注"}
            </button>
            <button
              className="icon-button reset"
              disabled={t.status === "idle"}
              aria-label="保存并结束计时"
              onClick={() => call("timer", { action: "finish" })}
            >
              <Square size={20} />
            </button>
          </div>
          <div className="cycle-dots">
            {Array.from({ length: 4 }, (_, i) => (
              <i key={i} className={i < state.cycles % 4 ? "filled" : ""} />
            ))}
            <span>{state.cycles % 4} / 4</span>
          </div>
        </Panel>
        <aside className="focus-side">
          <QuickLog call={call} />
          <div className="panel">
            <p className="eyebrow">今日专注</p>
            <h2>{duration(todayMs)}</h2>

            <div className="progress">
              <i
                style={{
                  width: `${Math.min(100, todayMs / (state.settings.dailyGoal * 600))}%`,
                }}
              />
            </div>
            <p className="hint">目标 {state.settings.dailyGoal} 分钟</p>
          </div>
          <div className="panel">
            <h3>最近的专注</h3>
            {state.logs
              .filter((l) => !l.deletedAt)
              .slice(-4)
              .reverse()
              .map((l) => (
                <div className="recent-log" key={l.id}>
                  <span>{l.title}</span>
                  <b>{duration(l.durationMs)}</b>
                </div>
              ))}
            {!state.logs.some((l) => !l.deletedAt) && (
              <p className="hint">暂无记录</p>
            )}
          </div>
        </aside>
      </div>
      {confirm && (
        <Modal title="放弃这一段计时？" onClose={() => setConfirm(false)}>
          <p>
            重置后，这一段时间不会加入工作记录。想保留时长，可以选择“保存并结束”。
          </p>
          <footer>
            <button className="button" onClick={() => setConfirm(false)}>
              继续保留
            </button>
            <button
              className="button"
              onClick={() => {
                call("timer", { action: "finish" });
                setConfirm(false);
              }}
            >
              保存并结束
            </button>
            <button
              className="button danger"
              onClick={() => {
                call("timer", { action: "reset" });
                setConfirm(false);
              }}
            >
              放弃并重置
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
