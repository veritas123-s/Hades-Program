import React, { useState } from "react";
import { Modal } from "../../components.jsx";
export default function EventEditor({ event, date, call, onClose }) {
  const [form, setForm] = useState(
      event || {
        title: "",
        start: date + "T09:00",
        end: date + "T10:00",
        location: "",
        notes: "",
      },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (action, p) => {
    setBusy(true);
    try {
      await call(action, p);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={event ? "编辑日程" : "新建日程"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run("event.save", form);
        }}
      >
        <label>
          日程标题
          <input
            aria-label="日程标题"
            maxLength={300}
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          {[
            ["start", "开始时间"],
            ["end", "结束时间"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                aria-label={"日程" + label}
                type="datetime-local"
                required
                min="2000-01-01T00:00"
                max="2099-12-31T23:59"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          地点
          <input
            aria-label="日程地点"
            value={form.location}
            maxLength={200}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </label>
        <label>
          备注
          <textarea
            aria-label="日程备注"
            value={form.notes}
            maxLength={5000}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </label>
        {form.allDay && <label className="toggle-row"><span>保留全天日程</span><input type="checkbox" checked={form.allDay} onChange={e=>setForm({...form,allDay:e.target.checked})}/></label>}
        <p className="hint">按北京时间保存。{form.allDay ? '全天日程的结束时间为最后一天之后的零点。' : ''}删除后可恢复。</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          {event && (
            <button
              className="button danger"
              type="button"
              disabled={busy}
              onClick={() => run("event.delete", { id: event.id })}
            >
              删除日程
            </button>
          )}
          <button className="button primary" disabled={busy}>
            保存日程
          </button>
        </footer>
      </form>
    </Modal>
  );
}
