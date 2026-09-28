import React from "react";
import {
  CheckSquare2,
  Columns2,
  CalendarDays,
  Clock3,
  Flame,
} from "lucide-react";
import { dayKey } from "../../domain.mjs";
import { duration } from "../../components.jsx";
import CalendarPage from "../notifications/CalendarPage.jsx";
import { Stat } from "../../shared/StatsElements.jsx";
import { WidgetBoard } from "../../platform/WidgetHost.jsx";
export default function DashboardPage({
  state,
  call,
  active,
  today,
  todayMs,
  setPage,
  setFilter,
  setProject,
  widgetActions,
  openAssistant,
}) {
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
          <h1>今天的安排</h1>
          <p>查看日程，选一件事开始。</p>
        </div>
        <button
          className="button"
          onClick={() => {
            setPage("tasks");
            setFilter("today");
            setProject("全部清单");
          }}
        >
          <CalendarDays size={16} />
          查看今日任务
        </button>
      </div>
      <CalendarPage {...{ state, call, setPage, widgetActions }} embedded />
      <div className="stat-grid">
        <Stat
          label="今日专注"
          value={duration(todayMs)}
          icon={Clock3}
          foot={`每日目标 ${state.settings.dailyGoal} 分钟`}
          progress={Math.min(100, todayMs / (state.settings.dailyGoal * 600))}
        />
        <Stat
          label="今日完成"
          value={String(
            state.tasks.filter(
              (t) =>
                t.completedAt &&
                !t.deletedAt &&
                dayKey(t.completedAt) === today,
            ).length,
          )}
          unit="个任务"
          icon={CheckSquare2}
          foot="每一点进展，都值得记录"
        />
        <Stat
          label="待办任务"
          value={String(active.length)}
          unit="个任务"
          icon={Columns2}
          foot={`${active.filter((t) => t.due && t.due < today).length} 个已逾期 · ${active.filter((t) => t.quadrant === "do").length} 个重要且紧急`}
        />
        <Stat
          label="今日番茄"
          value={String(
            state.logs.filter(
              (l) =>
                !l.deletedAt &&
                l.completed &&
                l.mode === "focus" &&
                dayKey(l.endedAt) === today,
            ).length,
          )}
          unit="个番茄"
          icon={Flame}
          foot="专注一小步，积累一大步"
        />
      </div>
      <WidgetBoard state={state} call={call} actions={widgetActions} />
    </>
  );
}
