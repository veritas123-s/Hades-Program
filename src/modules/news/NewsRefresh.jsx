import React, { useEffect, useState } from "react";
import { refreshLabel } from "../../news-refresh.mjs";
import "./news-refresh.css";

export default function NewsRefresh({ data }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  return <div className="news-refresh-status" role="status" aria-live="off">
    <span data-testid="news-countdown">{refreshLabel(data.shared, now)}</span>
    <small>每天每小时整点采集 · {data.shared?.sources?.length || 12} 个公众号</small>
    {data.shared?.lastFinishedAt && <small>上次完成：{new Date(data.shared.lastFinishedAt).toLocaleString("zh-CN")}</small>}
    {(data.sharedError || data.shared?.error) && <small>{data.sharedError || data.shared.error}</small>}
  </div>;
}
