import React, { useState } from "react";
import { beijingDay } from "../briefing.mjs";
import { CalendarClock, CheckSquare, Trash2, Settings2 } from "lucide-react";
export function CustomWidget({ id, state, call }) {
  const config = state.workspace.widgetData[id]?.data || {},
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState(config.title || ""),
    [date, setDate] = useState(config.date || ""),
    [itemText, setItemText] = useState("");
  const save = async (data) => {
    try {
      await call("widget.configure", {
        id,
        version: 1,
        data: { ...config, ...data },
      });
      return true;
    } catch {
      return false;
    }
  };
  const days = Math.round(
    (Date.parse((config.date || beijingDay()) + "T00:00:00Z") -
      Date.parse(beijingDay() + "T00:00:00Z")) /
      86400000,
  );
  return (
    <section className="panel custom-widget">
      <div className="panel-heading">
        <h3>
          {config.kind === "countdown" ? (
            <CalendarClock size={18} />
          ) : (
            <CheckSquare size={18} />
          )}{" "}
          {config.title}
        </h3>
        <div>
          <button
            className="icon-button"
            aria-label={`编辑${config.title}`}
            onClick={() => setEditing(!editing)}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={`删除${config.title}`}
            onClick={() => call("widget.delete", { id }).catch(() => {})}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {config.kind === "countdown" ? (
        <>
          <p className="countdown-days">
            {days === 0
              ? "就是今天"
              : days > 0
                ? `还有 ${days} 天`
                : `已过 ${-days} 天`}
          </p>
          <small>{config.date}</small>
        </>
      ) : (
        <div>
          {(config.items || []).map((item) => (
            <label className="checklist-line" key={item.id}>
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) =>
                  save({
                    items: config.items.map((x) =>
                      x.id === item.id
                        ? { ...x, done: event.target.checked }
                        : x,
                    ),
                  })
                }
              />
              {item.text}
            </label>
          ))}
        </div>
      )}
      {editing && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (await save({ title, date })) setEditing(false);
          }}
        >
          <label>
            名称
            <input
              value={title}
              maxLength={60}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          {config.kind === "countdown" ? (
            <label>
              日期
              <input
                type="date"
                value={date}
                required
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          ) : (
            <label>
              新事项
              <input
                value={itemText}
                maxLength={100}
                onChange={(event) => setItemText(event.target.value)}
              />
              <button
                type="button"
                className="button"
                onClick={() => {
                  if (itemText.trim()) {
                    save({
                      items: [
                        ...(config.items || []),
                        {
                          id: crypto.randomUUID(),
                          text: itemText.trim(),
                          done: false,
                        },
                      ].slice(0, 50),
                    });
                    setItemText("");
                  }
                }}
              >
                添加事项
              </button>
            </label>
          )}
          <button className="button">保存</button>
        </form>
      )}
    </section>
  );
}
