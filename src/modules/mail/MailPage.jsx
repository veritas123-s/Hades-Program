import React, { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, ListPlus } from "lucide-react";
import "./mail.css";

export default function MailPage({ call, state }) {
  const data = state.mail || { items: [] };
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!data.connected) setMessage(null);
  }, [data.connected]);
  const run = async (action, payload = {}) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await call(action, payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const disabled = busy || data.busy;
  const items = data.items.filter(
    (x) =>
      (!unreadOnly || x.unread) &&
      `${x.subject} ${x.from}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="mail-page">
      <header className="section-head">
        <h1>交大邮箱</h1>
        <div className="mail-actions">
          <button
            className="button"
            onClick={() =>
              run("link.open", { url: "https://mail.sjtu.edu.cn/" })
            }
          >
            <ExternalLink size={15} />
            网页邮箱
          </button>
          {data.connected && (
            <>
              <button
                className="button"
                disabled={disabled}
                onClick={() => {
                  setMessage(null);
                  run("mail.refresh");
                }}
              >
                <RefreshCw size={15} />
                刷新
              </button>
              <button
                className="button"
                onClick={() => {
                  setMessage(null);
                  setPassword("");
                  run("mail.disconnect");
                }}
              >
                断开
              </button>
            </>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data.connected ? (
        <form
          className="panel mail-login"
          onSubmit={async (e) => {
            e.preventDefault();
            const secret = password;
            setPassword("");
            await run("mail.connect", { username, password: secret });
          }}
        >
          <label>
            jAccount 用户名
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名或 @sjtu.edu.cn 邮箱"
              required
            />
          </label>
          <label>
            邮箱密码
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <p className="hint">
            密码仅用于当前会话，退出后清空。只读查看，不改变已读状态。
          </p>
          <button className="button primary" disabled={disabled}>
            {disabled ? "正在连接…" : "连接邮箱"}
          </button>
        </form>
      ) : (
        <>
          <div className="mail-toolbar">
            <span>
              {data.username}@sjtu.edu.cn · 未读 {data.unread ?? "未知"} / 共{" "}
              {data.total}
            </span>
            <label className="mail-filter">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              只看未读
            </label>
            <input
              aria-label="搜索邮件"
              placeholder="搜索主题或发件人"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="hint">
            显示收件箱最近 {data.items.length}{" "}
            封；筛选和搜索仅覆盖这些邮件。附件请在网页邮箱查看。
          </p>
          <div className="mail-columns">
            <div className="mail-list" aria-label="邮件列表">
              {!items.length && (
                <p className="hint">
                  {data.total ? "当前范围没有匹配的邮件" : "收件箱为空"}
                </p>
              )}
              {items.map((item) => (
                <button
                  key={`${item.validity}/${item.uid}`}
                  className={`mail-row ${message?.uid === item.uid ? "selected" : ""}`}
                  disabled={disabled}
                  onClick={async () => {
                    setMessage(null);
                    const result = await run("mail.read", {
                      uid: item.uid,
                      validity: item.validity,
                    });
                    if (result) setMessage(result);
                  }}
                >
                  <strong>
                    {item.unread && <span aria-label="未读">● </span>}
                    {item.subject}
                  </strong>
                  <span>{item.from}</span>
                  <time>
                    {item.date
                      ? new Date(item.date).toLocaleString("zh-CN")
                      : "日期未知"}
                  </time>
                </button>
              ))}
            </div>
            <article className="mail-detail">
              {message ? (
                <>
                  <h2>{message.subject}</h2>
                  <p className="hint">{message.from}</p>
                  <button
                    className="button"
                    disabled={disabled}
                    onClick={async () => {
                      const result = await run("mail.task", {
                        uid: message.uid,
                        validity: message.validity,
                      });
                      if (result)
                        setNotice(
                          result.existing
                            ? "这封邮件已有待办"
                            : "已添加到收集箱，可在任务清单编辑",
                        );
                    }}
                  >
                    <ListPlus size={15} />
                    转为待办
                  </button>
                  <div className="mail-body">
                    {message.text ||
                      "这封邮件没有可显示的文字，请在网页邮箱查看。"}
                  </div>
                  {message.attachments.length > 0 && (
                    <div className="mail-attachments">
                      <h3>附件</h3>
                      {message.attachments.map((x, i) => (
                        <p key={i}>
                          {x.name} · {Math.ceil(x.size / 1024)} KB
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="hint">
                  {disabled ? "正在读取…" : "选择一封邮件"}
                </p>
              )}
            </article>
          </div>
        </>
      )}
    </div>
  );
}
