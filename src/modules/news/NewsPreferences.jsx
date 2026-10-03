import React, { useEffect, useState } from "react";
import Panel from "../../shared/Panel.jsx";
import { NEWS_TOPICS, newsPreferences } from "../../news-preferences.mjs";
const split = (text) =>
  text
    .split(/[,，、;；\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
export default function NewsPreferences({ preferences, run, busy }) {
  const saved = JSON.stringify(newsPreferences(preferences));
  const [draft, setDraft] = useState(() => newsPreferences(preferences));
  const [keywords, setKeywords] = useState(draft.keywords.join("，"));
  const [blocked, setBlocked] = useState(draft.blockedKeywords.join("，"));
  useEffect(() => {
    const next = JSON.parse(saved);
    setDraft(next);
    setKeywords(next.keywords.join("，"));
    setBlocked(next.blockedKeywords.join("，"));
  }, [saved]);
  const toggle = (field, id, checked) =>
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], id]
        : current[field].filter((v) => v !== id),
    }));
  return (
    <Panel className="panel" title="筛选与订阅" defaultCollapsed>
      <form
        className="news-preferences"
        onSubmit={(event) => {
          event.preventDefault();
          run("news.configure", {
            preferences: {
              ...draft,
              keywords: split(keywords),
              blockedKeywords: split(blocked),
            },
          });
        }}
      >
        <label>
          订阅关键词
          <input
            aria-label="订阅关键词"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="例如：IgG4，影像，奖学金"
            maxLength={1230}
          />
        </label>
        <label>
          屏蔽关键词
          <input
            aria-label="屏蔽关键词"
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
            placeholder="多个词用逗号分隔"
            maxLength={1230}
          />
        </label>
        <table className="news-topic-table">
          <thead>
            <tr>
              <th>主题</th>
              <th>订阅</th>
              <th>屏蔽</th>
            </tr>
          </thead>
          <tbody>
            {NEWS_TOPICS.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.title}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`订阅${topic.title}`}
                    checked={draft.subscribedCategories.includes(topic.id)}
                    onChange={(event) =>
                      toggle(
                        "subscribedCategories",
                        topic.id,
                        event.target.checked,
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`屏蔽${topic.title}`}
                    checked={draft.blockedCategories.includes(topic.id)}
                    onChange={(event) =>
                      toggle(
                        "blockedCategories",
                        topic.id,
                        event.target.checked,
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline">
          <button className="button primary" disabled={busy}>
            保存订阅
          </button>
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() =>
              run("news.configure", { preferences: newsPreferences() })
            }
          >
            重置筛选
          </button>
        </div>
      </form>
    </Panel>
  );
}
