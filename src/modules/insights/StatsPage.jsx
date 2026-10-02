import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import {
  BarChart3,
  Plus,
  RotateCcw,
  Clock3,
  Download,
  Trash2,
} from "lucide-react";
import { QUADRANTS, dayKey, monday, dayTotals } from "../../domain.mjs";
import { Empty, Modal, duration } from "../../components.jsx";
import { WeekChart } from "../../shared/StatsElements.jsx";
export default function Stats({ state, call }) {
  const [manual, setManual] = useState(false),
    [range, setRange] = useState("week"),
    [trash, setTrash] = useState(false),
    totals = dayTotals(state.logs),
    today = dayKey();
  const since =
    range === "today"
      ? today
      : range === "week"
        ? monday(today)
        : range === "month"
          ? today.slice(0, 7) + "-01"
          : "2000-01-01";
  const logs = state.logs
    .filter(
      (l) => (trash ? l.deletedAt : !l.deletedAt) && dayKey(l.endedAt) >= since,
    )
    .toSorted((a, b) => b.startedAt - a.startedAt);
  const filteredMs = Object.entries(totals)
      .filter(([d]) => d >= since && d <= today)
      .reduce((n, [, ms]) => n + ms, 0),
    groups = {};
  for (const l of state.logs.filter((l) => !l.deletedAt)) {
    const ms = Object.entries(dayTotals([l]))
      .filter(([d]) => d >= since && d <= today)
      .reduce((n, [, v]) => n + v, 0);
    if (ms) groups[l.project] = (groups[l.project] || 0) + ms;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>时间记录</h1>
        </div>
        <div className="inline">
          <button className="button" onClick={() => call("export.csv")}>
            <Download size={16} />
            导出全部 CSV
          </button>
          <button className="button primary" onClick={() => setManual(true)}>
            <Plus size={16} />
            补记时间
          </button>
        </div>
      </div>
      <div className="tabs">
        {[
          ["today", "今天"],
          ["week", "本周"],
          ["month", "本月"],
          ["all", "全部"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={range === id ? "active" : ""}
            onClick={() => setRange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stats-summary">
        <Panel className="panel">
          <p className="eyebrow">累计专注</p>
          <h2 className="large-value">{duration(filteredMs)}</h2>
          <WeekChart totals={totals} />
        </Panel>
        <Panel className="panel">
          <h3>按清单分布</h3>
          {Object.entries(groups)
            .sort((a, b) => b[1] - a[1])
            .map(([name, ms], i) => (
              <div className="project-bar" key={name}>
                <div>
                  <span>
                    <i style={{ background: QUADRANTS[i % 4].color }} />
                    {name}
                  </span>
                  <b>{duration(ms)}</b>
                </div>
                <div className="progress">
                  <i
                    style={{
                      background: QUADRANTS[i % 4].color,
                      width: `${(ms / Math.max(1, filteredMs)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          {!Object.keys(groups).length && (
            <Empty icon={BarChart3} title="暂无记录" />
          )}
        </Panel>
      </div>
      <Panel className="panel records-panel">
        <div className="panel-heading">
          <div>
            <h3>
              工作记录 <span className="count">{logs.length}</span>
            </h3>
          </div>
          <button className="text-button" onClick={() => setTrash(!trash)}>
            {trash ? "返回工作记录" : "记录回收站"}
          </button>
        </div>
        {logs.length ? (
          <div className="records-list">
            <table>
              <thead>
                <tr>
                  <th>任务 / 工作内容</th>
                  <th>清单</th>
                  <th>时间</th>
                  <th>时长</th>
                  <th>方式</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <b>{l.title}</b>
                    </td>
                    <td>{l.project}</td>
                    <td>
                      {new Date(l.startedAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      —{" "}
                      {new Date(l.endedAt).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>{duration(l.durationMs)}</td>
                    <td>
                      <span className="tag">
                        {l.mode === "manual"
                          ? "手动补记"
                          : l.mode === "stopwatch"
                            ? "正计时"
                            : l.completed
                              ? "完整番茄"
                              : "部分专注"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={trash ? "恢复记录" : "删除记录"}
                        onClick={() =>
                          call(trash ? "log.restore" : "log.delete", {
                            id: l.id,
                          })
                        }
                      >
                        {trash ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={Clock3} title="暂无记录" />
        )}
      </Panel>
      {manual && <ManualLog call={call} onClose={() => setManual(false)} />}
    </>
  );
}
function ManualLog({ call, onClose }) {
  const [error, setError] = useState("");
  return (
    <Modal title="补记一段工作时间" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await call(
              "log.add",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
            onClose();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <label>
          工作内容
          <input name="title" required autoFocus placeholder="例如：文献阅读" />
        </label>
        <label>
          所属清单
          <input name="project" defaultValue="未分类" />
        </label>
        <div className="form-grid">
          <label>
            开始时间
            <input name="start" type="datetime-local" required />
          </label>
          <label>
            结束时间
            <input name="end" type="datetime-local" required />
          </label>
        </div>
        <p className="hint">每条不超过 24 小时，不能与已有记录重叠。</p>
        {error && <p className="error">{error}</p>}
        <footer>
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary">保存记录</button>
        </footer>
      </form>
    </Modal>
  );
}
