import React from "react";
import Panel from "../../shared/Panel.jsx";
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
  card,
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
      <Panel className="panel home-task-focus" title="待办任务">
        <div className="panel-heading">
          <h2>
            待办任务 <span className="count">{active.length}</span>
          </h2>
          <button
            className="text-button"
            onClick={() => {
              setPage("tasks");
              setFilter("active");
              setProject("全部清单");
            }}
          >
            查看全部
          </button>
        </div>
        {active
          .toSorted(
            (a, b) =>
              (a.quadrant === "do" ? 0 : 1) - (b.quadrant === "do" ? 0 : 1) ||
              (a.due || "9999").localeCompare(b.due || "9999"),
          )
          .slice(0, 3)
          .map(card)}
        {!active.length && <p>暂无待办</p>}
      </Panel>
      <CalendarPage {...{ state, call, setPage, widgetActions }} embedded />
      <Panel className="panel" title="专注统计" defaultCollapsed>
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
          />
        </div>
      </Panel>
      <WidgetBoard state={state} call={call} actions={widgetActions} />
    </>
  );
}
