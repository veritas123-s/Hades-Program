import Panel from "../../shared/Panel.jsx";
import TeamBrand from "../../shared/TeamBrand.jsx";
import React, { useState } from "react";
import { Cloud, RefreshCw, LogOut, UserRound, ShieldCheck } from "lucide-react";
const summary = (s) =>
  s
    ? `${s.tasks}项任务 · ${s.events}项日程 · ${s.courses}节课 · ${(s.focusMs / 3600000).toFixed(1)}小时专注`
    : "";
export default function AccountPage({ state, call, toast, locked = false }) {
  const a = state.account || {},
    [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [nickname, setNickname] = useState(a.user?.nickname || ""),
    [consent, setConsent] = useState(false),
    [resolve, setResolve] = useState("");
  const run = async (action, p = {}) => {
    setBusy(true);
    setError("");
    try {
      return await call(action, p);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (mode === "login") await run("account.login", { email, password });
    else if (!sent) {
      try {
        await run("account.send", { email, password, kind: mode });
        setSent(true);
        toast("验证码发送请求已完成，请查收邮箱");
      } catch {
        const current = await call("account.state");
        setSent(current.verificationPending);
      }
    } else {
      await run("account.verify", { code, password, email, kind: mode });
      setPassword("");
      setSent(false);
    }
  };
  return (
    <>
      {!locked && (
        <div className="page-heading">
          <div>
            <h1>账号与同步</h1>
          </div>
          <Cloud size={30} />
        </div>
      )}
      {!a.ready && (
        <div className="notice">
          正在准备账号连接。个人数据保留在本机，登录后才能查看和使用。
        </div>
      )}
      <div className={locked ? "account-grid account-locked" : "account-grid"}>
        <Panel className="panel">
          {a.user && (
            <div className="account-identity">
              <UserRound size={30} />
              <div>
                <h2>{a.user.nickname || "我的账号"}</h2>
                <p>{a.user.email}</p>
                <small>
                  {a.authenticated
                    ? "已登录"
                    : "本地账号空间 · 需要重新登录后同步"}
                </small>
              </div>
            </div>
          )}
          {a.pendingUser ? (
            <>
              <h2>进入 {a.pendingUser.email} 的空间</h2>
              <p>
                切换后会重新打开 医栈通。当前空间的数据和备份会留在这台电脑。
              </p>
              <p>{summary(a.localSummary)}</p>
              <div className="data-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => run("account.activate", { mode: "empty" })}
                >
                  打开账号独立空间
                </button>
                {a.canImportLegacy && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => run("account.activate", { mode: "copy" })}
                  >
                    复制本机数据到这个账号
                  </button>
                )}
              </div>
              <p className="hint">
                复制会保留旧数据，并将本机任务、专注记录、偏好及已加密的 API
                和校园配置归入此账号。密钥不会随云同步上传。
              </p>
            </>
          ) : !a.user || !a.authenticated ? (
            <>
              <h2>
                {mode === "login"
                  ? "登录 医栈通"
                  : mode === "register"
                    ? "创建云端账号"
                    : "找回密码"}
              </h2>
              <form onSubmit={submit} className="account-form">
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <label>
                  邮箱
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSent(false);
                    }}
                    disabled={busy}
                  />
                </label>
                {(mode !== "reset" || sent) && (
                  <label>
                    {mode === "reset" ? "新密码" : "密码"}
                    <input
                      type="password"
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      minLength={8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                )}
                {sent && (
                  <label>
                    邮箱验证码
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      pattern="[0-9]{4,8}"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                )}
                <button className="button primary" disabled={busy || !a.ready}>
                  {busy
                    ? mode === "login"
                      ? "正在登录…"
                      : sent
                        ? "正在验证…"
                        : "正在联系服务器并发送邮件…"
                    : mode === "login"
                      ? "登录"
                      : sent
                        ? "验证并继续"
                        : "发送验证码"}
                </button>
                {busy && (
                  <>
                    <p className="hint">
                      邮件服务可能需要几十秒；超过等待时间会提示原因。
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => call("account.cancel")}
                    >
                      停止等待
                    </button>
                  </>
                )}
                {sent && !busy && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={async () => {
                      await run("account.resend", { email, kind: mode });
                      toast("已提交重新发送请求。请检查收件箱和垃圾箱。");
                    }}
                  >
                    重新发送验证码
                  </button>
                )}
                {mode !== "login" && !sent && !busy && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setSent(true)}
                  >
                    已经收到验证码，继续验证
                  </button>
                )}
              </form>
              <div className="data-actions">
                {[
                  ["login", "登录"],
                  ["register", "注册账号"],
                  ["reset", "忘记密码"],
                ]
                  .filter(([v]) => v !== mode)
                  .map(([v, label]) => (
                    <button
                      className="text-button"
                      key={v}
                      disabled={busy}
                      onClick={() => {
                        setMode(v);
                        setSent(false);
                        setPassword("");
                        setCode("");
                        setError("");
                      }}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <form
                className="account-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await run("account.nickname", { nickname });
                  toast("昵称已保存");
                }}
              >
                <label>
                  昵称
                  <input
                    value={nickname}
                    maxLength={60}
                    required
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </label>
                <button className="button" disabled={busy}>
                  保存昵称
                </button>
              </form>
            </>
          )}
          {a.user && (
            <button
              className="button account-logout"
              disabled={busy}
              onClick={() => run("account.logout")}
            >
              <LogOut size={16} />
              退出账号并锁定个人空间
            </button>
          )}
        </Panel>
        {!locked && (
          <Panel className="panel">
            <h2>
              <Cloud size={21} /> 跨设备同步
            </h2>
            <p>
              同步账号资料、清单、任务、日程、课程、已保存的专注记录与主题偏好。回收站中的删除状态会一并保留。
            </p>
            <p className="hint">
              正在运行的计时留在当前电脑，保存后同步。背景图片文件、校园登录、模型密钥和微信提醒配置需要在其他电脑单独设置。
            </p>
            {a.user ? (
              <>
                <p role="status">{a.sync?.message || "尚未开启同步"}</p>
                {a.sync?.lastSync && (
                  <p className="hint">
                    上次同步：
                    {new Date(a.sync.lastSync).toLocaleString("zh-CN")}
                  </p>
                )}
                {!a.sync?.enabled ? (
                  <>
                    <label className="account-consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      将上述数据上传到 医栈通
                      的账号服务器，供我登录的其他电脑读取。
                    </label>
                    <button
                      className="button primary"
                      disabled={!consent || busy || !a.authenticated}
                      onClick={() =>
                        run("account.sync.configure", { enabled: true })
                      }
                    >
                      开启全量同步
                    </button>
                  </>
                ) : (
                  <div className="data-actions">
                    <button
                      className="button primary"
                      disabled={busy || a.sync?.phase === "syncing"}
                      onClick={() => run("account.sync")}
                    >
                      <RefreshCw size={16} />
                      立即同步
                    </button>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        run("account.sync.configure", { enabled: false })
                      }
                    >
                      暂停同步
                    </button>
                  </div>
                )}
                {a.sync?.conflict && (
                  <div className="account-conflict">
                    <h3>有两份修改需要核对</h3>
                    <p>这台电脑：{summary(a.sync.conflict.local)}</p>
                    <p>云端：{summary(a.sync.conflict.remote)}</p>
                    <p>
                      选择后会保存双方快照到本机备份，再以所选版本为准。另一份中的独有修改不会自动合并。
                    </p>
                    <label>
                      保留版本
                      <select
                        value={resolve}
                        onChange={(e) => setResolve(e.target.value)}
                      >
                        <option value="">请选择</option>
                        <option value="local">保留这台电脑的完整版本</option>
                        <option value="remote">保留云端的完整版本</option>
                      </select>
                    </label>
                    <button
                      className="button"
                      disabled={!resolve || busy}
                      onClick={async () => {
                        await run("account.sync", { resolution: resolve });
                        setResolve("");
                      }}
                    >
                      备份双方并确认采用
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="hint">登录后开启同步。</p>
            )}
            <div className="account-privacy">
              <ShieldCheck size={22} />
              <p>
                登录会话在本机加密保存；医栈通
                不记录密码、验证码或登录令牌日志，不采集操作轨迹。
              </p>
            </div>
          </Panel>
        )}
      </div>
      {locked && (
        <div className="auth-team-brand">
          <TeamBrand compact />
        </div>
      )}
      {locked && (
        <p className="auth-privacy">
          <ShieldCheck size={17} /> 未登录时，任务、课表、专注记录、API
          配置和个人偏好均已锁定。
        </p>
      )}
    </>
  );
}
