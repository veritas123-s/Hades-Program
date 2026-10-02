import React, { useEffect, useState } from "react";
export function UpdateBanner({ updates, call }) {
  if (!updates?.available || updates.dismissed) return null;
  return (
    <section
      className={`release-banner ${updates.release.urgent ? "urgent" : ""}`}
      aria-label="版本更新"
    >
      <div>
        <strong>
          {updates.release.urgent ? "重要更新 · " : ""}
          {updates.release.title}
        </strong>
        <span>V{updates.release.version}</span>
      </div>
      <details>
        <summary>更新内容</summary>
        <ul>
          {updates.release.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
      <div className="settings-actions">
        <button
          className="button primary"
          onClick={() => call("updates.download", { platform: "windows" })}
        >
          下载新版
        </button>
        <button className="button" onClick={() => call("updates.dismiss")}>
          稍后提醒
        </button>
      </div>
    </section>
  );
}
export default function UpdateCenter({ updates, call, toast, userId }) {
  const [email, setEmail] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setEmail(null);
    setError("");
    call("updates.email")
      .then((d) => {
        if (active) setEmail(d.emailUpdates);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  return (
    <section aria-label="更新通知中心">
      <h2>版本更新</h2>
      <p>当前版本 V{updates?.installed}</p>
      <button
        className="button"
        disabled={updates?.busy}
        onClick={() => call("updates.check")}
      >
        {updates?.busy ? "检查中…" : "检查更新"}
      </button>
      {updates?.error && <p role="status">{updates.error}</p>}
      {updates?.release && (
        <>
          <h3>
            {updates.available ? "新版已发布" : "最新公告"} · V
            {updates.release.version}
          </h3>
          <ul>
            {updates.release.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <div className="settings-actions">
            {Object.keys(updates.release.downloads).map((platform) => (
              <button
                key={platform}
                className="button"
                onClick={() => call("updates.download", { platform })}
              >
                {platform === "windows" ? "Windows 安装包" : "安卓安装包"}
              </button>
            ))}
          </div>
        </>
      )}
      <label className="toggle-row">
        <b>通过邮箱接收版本更新</b>
        <input
          aria-label="通过邮箱接收版本更新"
          type="checkbox"
          checked={email === true}
          disabled={email === null || saving}
          onChange={async (e) => {
            setSaving(true);
            try {
              const d = await call("updates.email", {
                emailUpdates: e.target.checked,
              });
              setEmail(d.emailUpdates);
              toast(d.emailUpdates ? "已订阅后续更新" : "已取消订阅");
            } catch (e) {
              setError(e.message);
            } finally {
              setSaving(false);
            }
          }}
        />
      </label>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
