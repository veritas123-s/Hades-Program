import React, { useState } from "react";
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function QuickLog({ call }) {
  const [minutes, setMinutes] = useState(25),
    [end, setEnd] = useState(localNow),
    [title, setTitle] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="panel quick-log">
      <summary>补记专注时长</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            if (
              !Number.isInteger(Number(minutes)) ||
              minutes < 1 ||
              minutes > 1440
            )
              throw Error("请输入 1–1440 分钟");
            const stop = new Date(end).getTime();
            await call("log.add", {
              title: title || "手动补记",
              start: new Date(stop - minutes * 60000).toISOString(),
              end: new Date(stop).toISOString(),
            });
            setMessage("已保存");
          } catch (e) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          工作内容
          <input
            aria-label="补记工作内容"
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：整理课堂笔记"
          />
        </label>
        <label>
          时长（分钟）
          <input
            aria-label="补记分钟"
            type="number"
            min="1"
            max="1440"
            required
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label>
          结束时间
          <input
            aria-label="补记结束时间"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button className="button" disabled={busy}>
          保存补记
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}
