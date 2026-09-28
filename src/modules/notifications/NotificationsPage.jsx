import { courseRelevance } from "../../learning-policy.mjs";
import React, { useState } from "react";
import {
  Bell,
  RefreshCw,
  QrCode,
  ArrowUpRight,
  Check,
  Trash2,
  Undo2,
  CalendarDays,
} from "lucide-react";
import { agenda, learningEntries } from "../../agenda.mjs";
import AgendaCard from "./AgendaCard.jsx";
import "./calendar.css";
export default function NotificationsPage({
  state,
  call,
  setPage,
  openAssistant,
  toast,
}) {
  const [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState([]),
    [error, setError] = useState("");
  const a = agenda(state, state.learning),
    read = state.workflows?.read || [],
    l = state.learning || {};
  const run = async (action, p) => {
    setBusy(true);
    setError("");
    try {
      await call(action, p);
      setSelected([]);
      if (action === "notification.delete")
        toast?.("已移至“已删除”；作业对应任务一并进入回收站，可恢复。");
      if (action === "notification.restore") toast?.("通知已恢复。");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const catalog = l.courses || [
    ...new Map(
      (l.items || [])
        .filter((x) => x.kind === "assignment" && x.courseKey)
        .map((x) => [x.courseKey, { key: x.courseKey, title: x.course }]),
    ).values(),
  ];
  const history = learningEntries(state, l, { history: true });
  const deleted = learningEntries(state, l, { deleted: true }).sort(
    (a, b) => b.time - a.time,
  );
  const entries =
    filter === "deleted"
      ? deleted
      : filter === "history"
        ? history
        : a.entries.filter(
            (e) =>
              filter === "all" ||
              (filter === "unread" && !read.includes(e.id)) ||
              filter === e.kind,
          );
  const notices = entries.filter((e) =>
    ["notice", "assignment"].includes(e.kind),
  );
  const selectedIds = notices
    .filter((e) => selected.includes(e.sourceId))
    .map((e) => e.sourceId);
  const readNotices = a.entries.filter(
    (e) => e.kind === "notice" && read.includes(e.id),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">日程与通知</p>
          <h1>日程与通知</h1>
          <p>课程、任务截止时间与学习通动态，集中在这里。</p>
        </div>
        <button className="button" onClick={() => setPage("calendar")}>
          <CalendarDays size={17} />
          打开日历
        </button>
        <span className="pill neutral">
          <Bell size={16} />
          {a.entries.filter((e) => !read.includes(e.id)).length} 条未读
        </span>
      </div>
      <AgendaCard {...{ state, call, setPage, openAssistant }} />
      <section className="panel learning-connect">
        <div>
          <h3>超星学习通</h3>
          <p>{l.message}</p>
          <small>
            上次成功：
            {l.lastSuccess
              ? new Date(l.lastSuccess).toLocaleString("zh-CN")
              : "尚未同步"}{" "}
            · 应用运行时每 30 分钟更新
          </small>
        </div>
        <div className="agenda-actions">
          <button
            className="button"
            disabled={busy || l.busy}
            onClick={() => run("learning.open")}
          >
            <QrCode size={16} />
            {l.connected ? "重新扫码 / 打开网页版" : "学习通扫码登录"}
          </button>
          <button
            className="button primary"
            disabled={busy || l.busy}
            onClick={() => run("learning.sync")}
          >
            <RefreshCw size={16} />
            {l.busy ? "读取中…" : "立即同步"}
          </button>
          <button
            className="text-button"
            onClick={() => run("learning.open", { kind: "notices" })}
          >
            官方通知 <ArrowUpRight size={14} />
          </button>
          {l.connected && (
            <button
              className="text-button"
              disabled={busy || l.busy}
              onClick={() => run("learning.logout")}
            >
              断开连接
            </button>
          )}
        </div>
        <details className="help-disclosure"><summary>同步范围与日期说明</summary><p>
          默认只显示近30天通知与近期未完成作业；往年、已截止、已完成内容收进“历史与待确认”。会话加密保存。仅倒计时的截止时间标为估算，不自动设定任务
          DDL。仅有月日时标为年份待核对，不自动写入任务截止日。通知最多读取最近
          5 页；覆盖范围见同步状态。
        </p></details>
        <label className="archive-course-option">
          <input
            type="checkbox"
            checked={state.workflows?.includeArchived ?? false}
            disabled={busy || l.busy}
            onChange={(e) =>
              run("workflow.configure", { includeArchived: e.target.checked })
            }
          />{" "}
          读取平台已归档课程供手动选择（默认不进入提醒，每轮最多30门）
        </label>
        <details className="learning-course-manager">
          <summary>管理关注课程（{catalog.length}）</summary>
          <p className="hint">
            自动模式参考近期课表和明确截止日期。未确认学期的旧课不会凭“未归档”进入提醒；可手动关注或不关注。修改立即影响显示，自动入库在下次同步时应用。
          </p>
          {catalog.map((c) => {
            const r = courseRelevance(c, state);
            return (
              <div className="learning-course-row" key={c.key}>
                <span>
                  <b>{c.title}</b>
                  <small>{r.reason}</small>
                </span>
                <select
                  aria-label={"关注课程 " + c.title}
                  disabled={busy || l.busy}
                  value={state.workflows?.courseChoices?.[c.key] || "auto"}
                  onChange={(e) =>
                    run("workflow.configure", {
                      courseChoice: { key: c.key, value: e.target.value },
                    })
                  }
                >
                  <option value="auto">自动筛选</option>
                  <option value="follow">关注此课</option>
                  <option value="hide">不再关注</option>
                </select>
              </div>
            );
          })}
          {!catalog.length && <p className="hint">同步后可选择课程。</p>}
        </details>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="notification-filters">
          {[
            ["all", "全部"],
            ["unread", "未读"],
            ["course", "课程"],
            ["task", "任务"],
            ["assignment", "作业"],
            ["notice", "超星通知"],
            ["history", `历史与待确认 ${history.length}`],
            ["deleted", `已删除 ${deleted.length}`],
          ].map(([id, title]) => (
            <button
              className={"button small " + (filter === id ? "primary" : "")}
              onClick={() => {
                setFilter(id);
                setSelected([]);
              }}
              key={id}
            >
              {title}
            </button>
          ))}
          <button
            className="text-button"
            disabled={busy || filter === "deleted" || !entries.length}
            onClick={() =>
              run("notification.read", { ids: entries.map((e) => e.id) })
            }
          >
            本页标为已读
          </button>
        </div>
        <div className="notice-management">
          <label>
            <input
              type="checkbox"
              aria-label="选择本页超星通知"
              disabled={!notices.length || busy}
              checked={
                notices.length > 0 && selectedIds.length === notices.length
              }
              onChange={(e) =>
                setSelected(
                  e.target.checked ? notices.map((n) => n.sourceId) : [],
                )
              }
            />
            选择本页学习通事项
          </label>
          <button
            className="button small"
            disabled={busy || !selectedIds.length}
            onClick={() =>
              run(
                filter === "deleted"
                  ? "notification.restore"
                  : "notification.delete",
                { ids: selectedIds },
              )
            }
          >
            {filter === "deleted" ? <Undo2 size={15} /> : <Trash2 size={15} />}
            {filter === "deleted" ? "恢复所选" : "删除所选"}
            {selectedIds.length ? `（${selectedIds.length}）` : ""}
          </button>
          {filter !== "deleted" && (
            <button
              className="text-button"
              disabled={busy || !readNotices.length}
              onClick={() =>
                run("notification.delete", {
                  ids: readNotices.map((e) => e.sourceId),
                })
              }
            >
              清理已读超星通知（{readNotices.length}）
            </button>
          )}
          <small>
            删除通知会同步隐藏全部列表、未读数和助手摘要；删除作业也会将对应本机任务移至回收站。均不修改学习通服务器，可恢复。
          </small>
        </div>
        <div className="notification-list">
          {entries.map((e) => (
            <article
              className={
                "notification-row " + (read.includes(e.id) ? "read" : "")
              }
              key={e.id}
            >
              {["notice", "assignment"].includes(e.kind) && (
                <input
                  className="notice-select"
                  type="checkbox"
                  aria-label={"选择通知 " + e.title}
                  disabled={busy}
                  checked={selected.includes(e.sourceId)}
                  onChange={(event) =>
                    setSelected((values) =>
                      event.target.checked
                        ? [...values, e.sourceId]
                        : values.filter((id) => id !== e.sourceId),
                    )
                  }
                />
              )}
              <span className={"agenda-kind " + e.kind}>
                <Bell size={18} />
              </span>
              <div>
                <small>
                  {e.label}
                  {e.estimated
                    ? " · 估算时间"
                    : e.yearInferred
                      ? " · 年份推定，请核对"
                      : ""}
                </small>
                <h3>{e.title}</h3>
                {e.reason && filter === "history" && (
                  <p className="hint">{e.reason}</p>
                )}
                {e.summary && (
                  <details>
                    <summary>查看通知摘要</summary>
                    <p>{e.summary}</p>
                  </details>
                )}
                <p>
                  {e.subtitle}
                  {e.time
                    ? " · " + new Date(e.time).toLocaleString("zh-CN")
                    : ""}
                </p>
              </div>
              {filter !== "deleted" && (
                <button
                  className="icon-button"
                  aria-label={"标为已读 " + e.title}
                  disabled={busy || read.includes(e.id)}
                  onClick={() => run("notification.read", { ids: [e.id] })}
                >
                  <Check size={18} />
                </button>
              )}
              {["notice", "assignment"].includes(e.kind) && (
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={
                    (filter === "deleted" ? "恢复" : "删除") +
                    (e.kind === "notice" ? "通知 " : "作业 ") +
                    e.title
                  }
                  onClick={() =>
                    run(
                      filter === "deleted"
                        ? "notification.restore"
                        : "notification.delete",
                      { ids: [e.sourceId] },
                    )
                  }
                >
                  {filter === "deleted" ? (
                    <Undo2 size={18} />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              )}
            </article>
          ))}
          {!entries.length && (
            <p className="empty-inbox">
              此筛选下暂无已同步事项。同步状态和课表覆盖情况见上方。
            </p>
          )}
        </div>
      </section>
      <section className="panel workflow-panel">
        <h2>Poseidon 工作流</h2>
        <p>以下操作在本机完成。已入库的任务沿用现有早晚报同步通道。</p>
        <label>
          <input
            type="checkbox"
            checked={state.workflows?.autoImport ?? true}
            onChange={(e) =>
              run("workflow.configure", { autoImport: e.target.checked })
            }
          />{" "}
          学习通未交作业自动加入任务清单
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.workflows?.autoCommit ?? false}
            onChange={(e) =>
              run("workflow.configure", { autoCommit: e.target.checked })
            }
          />{" "}
          授予自动建任务权限：明确说“添加 / 创建 / 安排”后直接保存助手草稿
        </label>
        <small>
          默认先核对草稿。此权限不包含删除历史记录、提交作业或发送消息。可在下方撤销自动添加的未完成任务，任务进入回收站。
        </small>
        <h3>最近执行</h3>
        {(state.workflows?.audit || []).slice(0, 10).map((x) => (
          <div className="workflow-entry" key={x.id}>
            <span>
              {x.kind} · {x.ids.length} 项{" "}
              <small>{new Date(x.at).toLocaleString("zh-CN")}</small>
            </span>
            <button
              className="text-button"
              disabled={x.undone || busy}
              onClick={() => run("workflow.undo", { id: x.id })}
            >
              {x.undone ? "已撤销" : "撤销新增"}
            </button>
          </div>
        ))}
        {!state.workflows?.audit?.length && (
          <p className="hint">暂无自动执行记录。</p>
        )}
      </section>
    </>
  );
}
