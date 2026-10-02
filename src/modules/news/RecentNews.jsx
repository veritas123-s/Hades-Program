import React from "react";
import Panel from "../../shared/Panel.jsx";
import LinkedText from "../../shared/LinkedText.jsx";
export default function RecentNews({ news, call }) {
  const recent = news?.recent;
  const cards = (groups) =>
    groups.map((group) => (
      <Panel
        className="panel recent-news-card"
        title={group.title}
        key={group.id}
      >
        <h3>{group.title}</h3>
        <div className="recent-meta">
          <span>
            {[...new Set(group.items.map((x) => x.source))]
              .slice(0, 2)
              .join(" · ")}
            {new Set(group.items.map((x) => x.source)).size > 2
              ? ` 等${new Set(group.items.map((x) => x.source)).size}个来源`
              : ""}
          </span>
          {group.items.length > 1 && (
            <span className="pill">已合并 {group.items.length} 条</span>
          )}
        </div>
        <LinkedText text={group.items[0].excerpt || ""} call={call} />
        <details>
          <summary>来源与原文 · {group.items.length}</summary>
          {group.items.map((item) => (
            <div className="recent-source" key={item.id}>
              <span>
                {item.source} ·{" "}
                {item.publishedPrecision === "day"
                  ? item.date
                  : new Date(item.publishedAt).toLocaleString("zh-CN")}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  call("news.open", { url: item.url }).catch(() => {})
                }
              >
                {item.searchResult ? "公开索引" : "原文"}
              </button>
              <button
                className="text-button"
                onClick={() =>
                  call("news.delete", { id: item.id }).catch(() => {})
                }
              >
                删除
              </button>
            </div>
          ))}
        </details>
      </Panel>
    ));
  return (
    <Panel className="panel recent-news" title="最近24小时消息">
      <h2>最近24小时消息</h2>
      {recent && (
        <small>
          {new Date(recent.from).toLocaleString("zh-CN")} —{" "}
          {new Date(recent.to).toLocaleString("zh-CN")}
        </small>
      )}
      {recent?.groups.length ? (
        cards(recent.groups)
      ) : (
        <p className="empty-line">暂无已收录消息</p>
      )}
      {!!recent?.uncertainGroups.length && (
        <details className="uncertain-news">
          <summary>发布时间待核对 · {recent.uncertainGroups.length}</summary>
          {cards(recent.uncertainGroups)}
        </details>
      )}
    </Panel>
  );
}
