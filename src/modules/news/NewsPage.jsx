import NewsCover from "./NewsCover.jsx";
import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import { RefreshCw, ExternalLink, Trash2, Undo2 } from "lucide-react";
import LinkedText from "../../shared/LinkedText.jsx";
import RecentNews from "./RecentNews.jsx";
import NewsPreferences from "./NewsPreferences.jsx";
import {
  NEWS_TOPICS,
  newsCategories,
  selectNews,
} from "../../news-preferences.mjs";
export default function NewsPage({ state, call }) {
  const data = state.news || {},
    [filter, setFilter] = useState("recent"),
    [category, setCategory] = useState("all"),
    [organization, setOrganization] = useState("全部组织"),
    [newOrganization, setNewOrganization] = useState(""),
    [url, setURL] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const matches = (x) =>
    (category === "all" || newsCategories(x).includes(category)) &&
    (!query.trim() ||
      [x.title, x.excerpt, x.source].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ));
  const matchingGroups = (groups) =>
    groups
      .map((group) => ({ ...group, items: group.items.filter(matches) }))
      .filter((group) => group.items.length)
      .map((group) => ({ ...group, title: group.items[0].title }));
  const visibleNews = {
    ...data,
    recent: data.recent && {
      ...data.recent,
      groups: matchingGroups(data.recent.groups),
      uncertainGroups: matchingGroups(data.recent.uncertainGroups),
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
  const items = (
    filter === "deleted"
      ? data.items || []
      : filter === "subscribed"
        ? data.subscriptions || []
        : selectNews(data.items || [], data.preferences)
  )
    .filter(matches)
    .filter((x) =>
      filter === "deleted"
        ? x.deletedAt
        : !x.deletedAt &&
          (filter !== "columns" ||
            organization === "全部组织" ||
            x.source === organization),
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
          {data.busy ? "采集中…" : "采集最新信息"}
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
          className={filter === "subscribed" ? "active" : ""}
          onClick={() => setFilter("subscribed")}
        >
          我的订阅
        </button>
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
      <div className="inline news-filter">
        <label>
          分类{" "}
          <select
            aria-label="快讯分类"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">全部分类</option>
            {NEWS_TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <NewsPreferences
        preferences={data.preferences}
        run={run}
        busy={busy || data.busy}
      />
      <Panel className="panel" title="来源与收录" defaultCollapsed>
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
      {filter === "subscribed" && !items.length && (
        <p className="empty-line">暂无符合订阅条件的消息</p>
      )}
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
            {filter === "deleted"
              ? "没有已删除消息"
              : "该组织尚未收录文章，可补充原文链接或重新采集。"}
          </p>
        </Panel>
      )}
    </>
  );
}
