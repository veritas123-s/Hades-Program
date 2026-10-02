import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import { Cloud, RefreshCw, Settings2 } from "lucide-react";
import CloudSetup from "./CloudSetup.jsx";
export default function CloudConnection({ data, call, onUpdate }) {
  const sync = data?.sync;
  const [edit, setEdit] = useState(false),
    [url, setURL] = useState(""),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action, payload = {}) {
    setBusy(true);
    setError("");
    try {
      const next = await call(action, payload);
      onUpdate(next);
      return next;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      className={`panel cloud-sync-card sync-${sync?.phase || "not_configured"}`}
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">云端提醒</p>
          <h3>
            <Cloud size={18} /> 早晚报自动同步
          </h3>
        </div>
        <button
          className="icon-button"
          aria-label="云同步连接设置"
          onClick={() => {
            setURL(sync?.endpoint || "");
            setEdit(!edit);
          }}
        >
          <Settings2 size={16} />
        </button>
      </div>
      <p role="status">{sync?.message || "尚未连接云端。"}</p>
      <CloudSetup call={call} />
      {sync?.lastSuccess && (
        <p className="hint">
          最近确认：{new Date(sync.lastSuccess).toLocaleString("zh-CN")}
        </p>
      )}
      <p className="hint">
        添加、修改、完成任务后自动上传。电脑关闭后，微信早晚报仍使用最近成功同步的数据；任务快照超过
        48 小时会提示更新。
      </p>
      {sync?.configured && (
        <button
          className="button"
          disabled={busy || sync.busy}
          onClick={() => run("briefing.sync.now")}
        >
          <RefreshCw size={15} className={sync.busy ? "spin" : ""} />
          立即同步
        </button>
      )}
      {edit && (
        <form
          className="cloud-sync-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("briefing.sync.configure", { url, secret })) {
              setSecret("");
              setEdit(false);
            }
          }}
        >
          <label>
            云同步地址
            <input
              type="url"
              aria-label="云同步地址"
              placeholder="https://…ap-shanghai.tencentscf.com/veritas-sync"
              value={url}
              onChange={(e) => setURL(e.target.value)}
            />
          </label>
          <label>
            独立同步密钥
            <input
              type="password"
              aria-label="云同步密钥"
              autoComplete="new-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={
                sync?.configured ? "已加密保存；留空沿用" : "由云端部署时生成"
              }
            />
          </label>
          <p className="hint">
            此处使用独立的快报同步密钥，学校模型密钥只用于 AI 助手。
          </p>
          <button className="button primary" disabled={busy || !url}>
            保存连接
          </button>
          {sync?.configured && (
            <button
              type="button"
              className="text-button"
              disabled={busy || sync.busy}
              onClick={() => run("briefing.sync.disconnect")}
            >
              停止自动同步
            </button>
          )}
        </form>
      )}
      {(error || sync?.warning) && (
        <p className="error" role="alert">
          {error || sync.warning}
        </p>
      )}
    </Panel>
  );
}
