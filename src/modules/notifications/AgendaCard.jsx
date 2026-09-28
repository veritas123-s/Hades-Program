import React from "react";
import { ArrowRight, Bell, Play, CalendarDays } from "lucide-react";
import { agenda } from "../../agenda.mjs";
export default function AgendaCard({ state, call, setPage, openAssistant }) {
  const a = agenda(state, state.learning),
    r = a.recommendation;
  return (
    <section className="agenda-hero">
      <div className="next-action">
        <div className="orbit-art" aria-hidden="true">
          <span />
          <i />
          <b>H</b>
        </div>
        <p className="eyebrow">接下来</p>
        <h2>{r.title}</h2>
        <p>{r.reason}</p>
        <div className="agenda-actions">
          <button
            className="button primary"
            onClick={async () => {
              if (r.action === "start") {
                await call("timer", {
                  action: "start",
                  mode: "focus",
                  taskId: r.taskId,
                  durationMinutes: r.minutes,
                });
                setPage("focus");
              } else setPage(r.action);
            }}
          >
            <Play size={15} />
            {r.action === "start" ? `专注 ${r.minutes} 分钟` : "查看安排"}
          </button>
          {openAssistant && (
            <button className="text-button" onClick={openAssistant}>
              询问 Poseidon <ArrowRight size={14} />
            </button>
          )}
        </div>
        <small>根据当前计时、课程空档、截止日期和四象限在本机更新</small>
      </div>
      <div className="today-inbox">
        <header>
          <h3>
            <Bell size={17} /> 今日与临近事项
          </h3>
          <button
            className="text-button"
            onClick={() => setPage("notifications")}
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </header>
        {a.entries.slice(0, 3).map((e) => (
          <button
            className="agenda-mini"
            key={e.id}
            onClick={() => setPage("notifications")}
          >
            <span className={"agenda-kind " + e.kind}>
              {e.kind === "course" ? (
                <CalendarDays size={16} />
              ) : (
                <Bell size={16} />
              )}
            </span>
            <span>
              <b>{e.title}</b>
              <small>
                {e.label} ·{" "}
                {e.kind === "course"
                  ? e.subtitle
                  : e.time
                    ? new Date(e.time).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : e.subtitle}
              </small>
            </span>
          </button>
        ))}
        {!a.entries.length && <p>当前没有已同步的临近事项。</p>}
        {!a.courseVerified && (
          <small className="hint">今日课表未验证，请到校园模块同步。</small>
        )}
      </div>
    </section>
  );
}
