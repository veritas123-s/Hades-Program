import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Play,
  Check,
  CalendarDays,
  Pencil,
} from "lucide-react";
import { QUADRANTS, dayKey } from "./domain.mjs";
export const minutes = (ms) => `${Math.round(ms / 60000)} 分钟`;
export const duration = (ms) => {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`;
};
export const timeText = (ms) => {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${s >= 3600 ? String(Math.floor(s / 3600)).padStart(2, "0") + ":" : ""}${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={30} />}
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function TaskEditor({ task = {}, projects, onSave, onClose, onDelete }) {
  const [form, setForm] = useState({
    title: "",
    project: "收集箱",
    quadrant: "plan",
    due: "",
    dueTime: "",
    reminder: "",
    repeat: "none",
    estimate: 25,
    notes: "",
    subtasks: [],
    ...task,
  });
  const [sub, setSub] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addSub = () => {
    if (sub.trim()) {
      field("subtasks", [
        ...form.subtasks,
        { id: crypto.randomUUID(), title: sub.trim(), done: false },
      ]);
      setSub("");
    }
  };
  return (
    <Modal
      title={task.id ? "编辑任务" : "把想做的事，写下来"}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await onSave(form);
            onClose();
          } catch (e) {
            setError(e.message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          任务名称
          <input
            autoFocus
            required
            maxLength={300}
            placeholder="接下来，想完成什么？"
            value={form.title}
            onChange={(e) => field("title", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            所属清单
            <input
              aria-label="所属清单"
              list="project-list"
              value={form.project}
              onChange={(e) => field("project", e.target.value)}
            />
            <datalist id="project-list">
              {projects.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </datalist>
          </label>
          <label>
            优先级
            <select
              aria-label="优先级"
              value={form.quadrant}
              onChange={(e) => field("quadrant", e.target.value)}
            >
              {QUADRANTS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.subtitle}
                </option>
              ))}
            </select>
          </label>
          <label>
            截止日期
            <input
              type="date"
              value={form.due}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  due: e.target.value,
                  dueTime: e.target.value ? f.dueTime : "",
                }))
              }
            />
          </label>
          <label>
            截止钟点（可选）
            <input
              type="time"
              value={form.dueTime || ""}
              disabled={!form.due}
              onChange={(e) => field("dueTime", e.target.value)}
            />
          </label>
          <label>
            预计用时（分钟）
            <input
              type="number"
              min="0"
              max="10000"
              value={form.estimate}
              onChange={(e) => field("estimate", e.target.value)}
            />
          </label>
          <label>
            提醒时间
            <input
              type="datetime-local"
              value={form.reminder}
              onChange={(e) => field("reminder", e.target.value)}
            />
          </label>
          <label>
            完成后重复
            <select
              aria-label="完成后重复"
              value={form.repeat}
              onChange={(e) => field("repeat", e.target.value)}
            >
              <option value="none">不重复</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
            </select>
          </label>
        </div>
        <label>子任务</label>
        <div className="subtasks">
          {form.subtasks.map((s, i) => (
            <div className="inline" key={s.id}>
              <input
                type="checkbox"
                checked={s.done}
                aria-label={s.title}
                onChange={(e) =>
                  field(
                    "subtasks",
                    form.subtasks.map((x, j) =>
                      j === i ? { ...x, done: e.target.checked } : x,
                    ),
                  )
                }
              />
              <span>{s.title}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`删除子任务 ${s.title}`}
                onClick={() =>
                  field(
                    "subtasks",
                    form.subtasks.filter((_, j) => j !== i),
                  )
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="inline">
          <input
            value={sub}
            placeholder="拆成一个小步骤…"
            onChange={(e) => setSub(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSub();
              }
            }}
          />
          <button type="button" className="button" onClick={addSub}>
            <Plus size={16} />
            添加步骤
          </button>
        </div>
        <label>
          笔记
          <textarea
            rows={3}
            maxLength={10000}
            value={form.notes}
            onChange={(e) => field("notes", e.target.value)}
            placeholder="思路、链接、下一步…"
          />
        </label>
        <p className="hint">
          提醒需要应用保持运行，可收起到系统托盘。重复任务在完成后生成下一次。
        </p>
        {error && <p className="error">{error}</p>}
        <footer>
          {task.id && onDelete && (
            <button
              type="button"
              className="button danger"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onDelete();
                } catch (e) {
                  setError(e.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Trash2 size={15} />
              删除任务
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "保存中…" : "保存任务"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function TaskCard({ task, call, onEdit, onFocus, compact = false }) {
  const q = QUADRANTS.find((q) => q.id === task.quadrant),
    late = task.due && task.due < dayKey() && !task.completedAt;
  return (
    <article
      className={`task-card ${task.completedAt ? "done" : ""} ${compact ? "compact" : ""}`}
      draggable={!task.completedAt}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
    >
      <button
        className="task-check"
        aria-label={
          task.completedAt ? `重新打开 ${task.title}` : `完成 ${task.title}`
        }
        onClick={() => call("task.complete", { id: task.id })}
      >
        {task.completedAt && <Check size={13} />}
      </button>
      <div className="task-body" onDoubleClick={() => onEdit(task)}>
        <button className="task-title" onClick={() => onEdit(task)}>
          {task.title}
        </button>
        <div className="task-meta">
          <span className="project-tag">
            <i style={{ background: q.color }} />
            {task.project}
          </span>
          {task.due && (
            <span className={late ? "overdue" : ""}>
              <CalendarDays size={12} />
              {task.due.slice(5)}
              {late ? " · 已逾期" : ""}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span>
              {task.subtasks.filter((s) => s.done).length}/
              {task.subtasks.length} 步骤
            </span>
          )}
          {task.repeat !== "none" && (
            <span>↻ {task.repeat === "daily" ? "每天" : "每周"}</span>
          )}
        </div>
      </div>
      <div className="task-actions">
        {!task.completedAt && (
          <button
            className="icon-button"
            title="开始专注"
            aria-label={`专注 ${task.title}`}
            onClick={() => onFocus(task)}
          >
            <Play size={15} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={`编辑 ${task.title}`}
          onClick={() => onEdit(task)}
        >
          <Pencil size={14} />
        </button>
        <button
          className="icon-button"
          aria-label={`删除 ${task.title}`}
          onClick={() => call("task.delete", { id: task.id })}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
