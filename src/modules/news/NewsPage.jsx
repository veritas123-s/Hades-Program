import NewsCover from "./NewsCover.jsx";
import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import { RefreshCw, ExternalLink, Trash2, Undo2 } from "lucide-react";
import LinkedText from "../../shared/LinkedText.jsx";
import RecentNews from "./RecentNews.jsx";
export default function NewsPage({ state, call }) {
  const data = state.news || {},
    [filter, setFilter] = useState("recent"),
    [organization, setOrganization] = useState("全部组织"),
    [newOrganization, setNewOrganization] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const matches = (x) =>
    !query.trim() ||
    [x.title, x.excerpt, x.source].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
  const visibleNews = {
    ...data,
    recent: data.recent && {
      ...data.recent,
      groups: data.recent.groups.filter((g) => g.items.some(matches)),
      uncertainGroups: data.recent.uncertainGroups.filter((g) =>
        g.items.some(matches),
      ),
    },
  };
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
  const items = (data.items || [])
    .filter(matches)
    .filter((x) =>
      filter === "deleted"
        ? x.deletedAt
        : !x.deletedAt &&
          (organization === "全部组织" || x.source === organization),
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
          <h1>校园快讯</h1>
        </div>
        <button
          className="button primary"
          disabled={busy || data.busy}
          onClick={() => run("news.collect", { windowHours: 24 })}
        >
          <RefreshCw size={16} />
          {data.busy ? "更新中…" : "刷新"}
        </button>
      </div>
      <input
        className="news-search"
        aria-label="搜索校园快讯"
        placeholder="搜索标题、摘要或来源"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="tabs">
        <button
          className={filter === "recent" ? "active" : ""}
          onClick={() => setFilter("recent")}
        >
          最近24小时
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
      </div>
      <p className="muted" role="status">
        {data.lastAttempt
          ? `更新于 ${new Date(data.lastAttempt).toLocaleString("zh-CN")}`
          : "等待更新"}
        {!!data.coverage?.some((x) => x.status === "unavailable") &&
          " · 部分来源暂未更新，已保留现有内容"}
      </p>
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
      {data.summaryError && <p role="status">{data.summaryError}</p>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {filter === "recent" && <RecentNews news={visibleNews} call={call} />}
      <div className="news-list" hidden={filter === "recent"}>
        {items.map((x) => (
          <article className="panel news-article-row" key={x.id}>
            <div className="news-visual-row">
              <NewsCover item={x} call={call} />
              <div className="news-copy">
                <small>
                  {x.source} · 发布于 {x.date}
                </small>
                <h2>
                  <button
                    className="news-title-link"
                    onClick={() => run("news.open", { url: x.url })}
                  >
                    {x.title}
                  </button>
                </h2>
                {x.excerpt && <LinkedText text={x.excerpt} call={call} />}
              </div>
            </div>
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
            {filter === "deleted" ? "没有已删除消息" : "该组织暂无已收录文章。"}
          </p>
        </Panel>
      )}
    </>
  );
}
