import NewsCover from "./NewsCover.jsx";
import React from "react";
import Panel from "../../shared/Panel.jsx";
import LinkedText from "../../shared/LinkedText.jsx";
export default function RecentNews({ news, call, defaultCollapsed = false }) {
  const recent = news?.recent;
  const cards = (groups) =>
    groups.map((group) => (
      <article className="panel recent-news-card" key={group.id}>
        <div className="news-visual-row">
          <NewsCover
            item={group.items.find((x) => x.imageURL) || group.items[0]}
            call={call}
          />
          <div className="news-copy">
            <h3>
              <button
                className="news-title-link"
                onClick={() =>
                  call("news.open", { url: group.items[0].url }).catch(() => {})
                }
              >
                {group.title}
              </button>
            </h3>
            <div className="recent-meta">
              <span>
                {group.items[0].publishedPrecision === "day"
                  ? group.items[0].date
                  : new Date(group.items[0].publishedAt).toLocaleString(
                      "zh-CN",
                      {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
              </span>
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
          </div>
        </div>
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
      </article>
    ));
  return (
    <Panel
      className="panel recent-news"
      title="最近24小时消息"
      defaultCollapsed={defaultCollapsed}
    >
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
