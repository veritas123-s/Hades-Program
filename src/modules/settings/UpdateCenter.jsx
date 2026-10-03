import React, { useEffect, useState } from "react";
function InstallUpdate({ updates, call }) {
  const [error, setError] = useState(""),
    [starting, setStarting] = useState(false);
  const install = updates?.installation;
  if (!updates?.available || !install?.supported) return null;
  const busy =
    starting ||
    ["downloading", "verifying", "preparing", "installing"].includes(
      install.phase,
    );
  const label =
    install.phase === "downloading"
      ? `下载中 ${install.total ? Math.floor((install.received / install.total) * 100) + "%" : "…"}`
      : install.phase === "verifying"
        ? "校验中…"
        : install.phase === "preparing"
          ? "准备安装…"
          : install.phase === "installing"
            ? "安装中…"
            : starting
              ? "准备中…"
              : "一键更新";
  return (
    <div>
      <button
        className="button primary"
        disabled={busy}
        onClick={async () => {
          setStarting(true);
          setError("");
          try {
            await call("updates.install");
          } catch (e) {
            setError(e.message);
          } finally {
            setStarting(false);
          }
        }}
      >
        {label}
      </button>
      {busy && <p role="status">安装时会关闭程序，完成后自动打开。</p>}
      {(error || install.error) && <p role="alert">{error || install.error}</p>}
    </div>
  );
}
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
        <InstallUpdate updates={updates} call={call} />
        <button
          className="button"
          onClick={() => call("updates.download")}
          disabled={!updates.release.downloads[updates.platform]}
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
            <InstallUpdate updates={updates} call={call} />
            {Object.keys(updates.release.downloads).map((platform) => (
              <button
                key={platform}
                className="button"
                onClick={() => call("updates.download", { platform })}
              >
                {
                  {
                    windows: "Windows 安装包",
                    android: "安卓安装包",
                    macos_x64: "macOS · Intel",
                    macos_arm64: "macOS · Apple 芯片",
                  }[platform]
                }
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
