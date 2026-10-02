import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import { RefreshCw, ExternalLink, Trash2, Undo2 } from "lucide-react";
import { beijingDay } from "../../briefing.mjs";
import LinkedText from "../../shared/LinkedText.jsx";
import RecentNews from "./RecentNews.jsx";
export default function NewsPage({ state, call }) {
  const data = state.news || {},
    [date, setDate] = useState(beijingDay()),
    [filter, setFilter] = useState("recent"),
    [organization, setOrganization] = useState("全部组织"),
    [newOrganization, setNewOrganization] = useState(""),
    [url, setURL] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const run = async (action, p = {}) => {
    setBusy(true);
    setError("");
    try {
      await call(action, p);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const items = (data.items || []).filter((x) =>
    filter === "deleted"
      ? x.deletedAt
      : !x.deletedAt &&
        (filter === "columns"
          ? organization === "全部组织" || x.source === organization
          : x.activityDate === date),
  );
  const organizations = [
    ...new Set([
      "交大新闻网",
      "医学院新闻网",
      ...(data.sources || []),
      ...(data.items || []).map((x) => x.source),
    ]),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">校园快讯</p>
          <h1>校园快讯</h1>
        </div>
        <button
          className="button primary"
          disabled={busy || data.busy}
          onClick={() => run("news.collect", { windowHours: 24 })}
        >
          <RefreshCw size={16} />
          {data.busy ? "采集中…" : "采集最新信息"}
        </button>
      </div>
      <div className="tabs">
        <button className={filter === "recent" ? "active" : ""} onClick={() => setFilter("recent")}>最近24小时</button>
        <button
          className={filter === "today" ? "active" : ""}
          onClick={() => setFilter("today")}
        >
          当日活动
        </button>
        <button
          className={filter === "columns" ? "active" : ""}
          onClick={() => setFilter("columns")}
        >
          组织专栏
        </button>
        <button
          className={filter === "deleted" ? "active" : ""}
          onClick={() => setFilter("deleted")}
        >
          已删除
        </button>
        <input
          aria-label="快讯日期"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <Panel className="panel" title="采集设置与来源" defaultCollapsed>
        <label className="toggle-row">
          应用运行时每小时自动采集
          <input
            type="checkbox"
            checked={data.automatic ?? true}
            onChange={(e) =>
              run("news.configure", { automatic: e.target.checked })
            }
          />
        </label>
        <p role="status">
          {data.lastAttempt
            ? `上次采集：${new Date(data.lastAttempt).toLocaleString("zh-CN")}`
            : "首次采集尚未完成"}{" "}
        </p>
        <details>
          <summary>
            来源覆盖 · {data.sources?.length || 12} 个公众号＋学校新闻网
          </summary>
          <div className="news-coverage">
            {(data.coverage?.length
              ? data.coverage
              : [
                  ...(data.sources || []).map((source) => ({
                    source,
                    note: "尚未采集",
                  })),
                ]
            ).map((x) => (
              <p key={x.source}>
                <strong>{x.source}</strong> ·{" "}
                {x.status === "partial"
                  ? "部分覆盖"
                  : x.status === "unavailable"
                    ? "未能读取"
                    : "待采集"}{" "}
                · {x.note}
              </p>
            ))}
          </div>
        </details>
      </Panel>
      {filter === "columns" && (
        <Panel className="panel organization-directory">
          <div className="organization-buttons">
            {["全部组织", ...organizations].map((name) => (
              <button
                key={name}
                className={`button ${organization === name ? "primary" : ""}`}
                onClick={() => setOrganization(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <form
            className="news-import"
            onSubmit={async (event) => {
              event.preventDefault();
              await run("news.follow", { name: newOrganization });
              setNewOrganization("");
            }}
          >
            <label>
              关注新组织
              <input
                aria-label="公众号准确名称"
                value={newOrganization}
                onChange={(event) => setNewOrganization(event.target.value)}
                maxLength={60}
                required
                placeholder="也可以对 Poseidon 说：关注某某公众号"
              />
            </label>
            <button className="button" disabled={busy}>
              关注
            </button>
          </form>
          {organization !== "全部组织" &&
            data.sources?.includes(organization) && (
              <button
                className="text-button"
                onClick={() => run("news.unfollow", { name: organization })}
              >
                取消关注（保留历史文章）
              </button>
            )}
        </Panel>
      )}
      {data.summary?.date === date && filter === "today" && (
        <Panel className="panel">
          <h2>Poseidon 整理</h2>
          <LinkedText text={data.summary.text} call={call} />
        </Panel>
      )}
      {data.summaryError && <p role="status">{data.summaryError}</p>}
      <Panel className="panel" title="补充文章" defaultCollapsed>
        <form
          className="news-import"
          onSubmit={async (e) => {
            e.preventDefault();
            await run("news.import", { url });
            setURL("");
          }}
        >
          <label>
            补充公众号文章链接
            <input
              type="url"
              required
              placeholder="https://mp.weixin.qq.com/…"
              value={url}
              onChange={(e) => setURL(e.target.value)}
            />
          </label>
          <button className="button" disabled={busy || data.busy}>
            读取文章
          </button>
        </form>
      </Panel>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {filter === "recent" && <RecentNews news={data} call={call}/>}
      <div className="news-list" hidden={filter === "recent"}>
        {items.map((x) => (
          <article className="panel" key={x.id}>
            <small>
              {x.source} · 发布于 {x.date}
              {x.activityDate
                ? ` · 活动 ${x.activityDate}`
                : " · 活动日期待确认"}
            </small>
            <h2>{x.title}</h2>
            {x.excerpt && <LinkedText text={x.excerpt} call={call} />}
            {!x.deletedAt && (
              <label className="activity-date">
                核对活动日期
                <input
                  aria-label={`${x.title}活动日期`}
                  type="date"
                  value={x.activityDate || ""}
                  onChange={(event) => {
                    if (event.target.value)
                      run("news.activity", {
                        id: x.id,
                        date: event.target.value,
                      });
                  }}
                />
              </label>
            )}
            <div className="agenda-actions">
              <button
                className="button"
                onClick={() => run("news.open", { url: x.url })}
              >
                <ExternalLink size={15} />
                {x.searchResult ? "查看公开索引" : "查看原文"}
              </button>
              <button
                className="text-button"
                onClick={() =>
                  run(x.deletedAt ? "news.restore" : "news.delete", {
                    id: x.id,
                  })
                }
              >
                {x.deletedAt ? <Undo2 size={16} /> : <Trash2 size={16} />}{" "}
                {x.deletedAt ? "恢复" : "删除"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && filter !== "recent" && (
        <Panel className="panel">
          <p>
            {filter === "deleted"
              ? "没有已删除消息"
              : filter === "columns"
                ? "该组织尚未收录文章，可补充原文链接或重新采集。"
                : "没有已确认在这一天举行的活动，其他消息请到组织专栏查看。"}
          </p>
        </Panel>
      )}
    </>
  );
}
