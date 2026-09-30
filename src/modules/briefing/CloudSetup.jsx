import React, { useEffect, useState } from "react";
import { QrCode, Check, ExternalLink } from "lucide-react";
import { createPortal } from "react-dom";
import { Modal } from "../../components.jsx";
import "./cloud-setup.css";

export default function CloudSetup({ call }) {
  const [data, setData] = useState(null),
    [open, setOpen] = useState(false),
    [token, setToken] = useState(""),
    [channel, setChannel] = useState(null),
    [email, setEmail] = useState({
      host: "smtp.qq.com",
      port: 465,
      user: "",
      to: "",
      password: "",
    }),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let live = true,
      running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const next = await call("briefing.cloud.state");
        if (live) setData(next);
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        running = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 1800);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open, call]);
  async function run(action, payload = {}) {
    setBusy(true);
    setError("");
    try {
      const next = await call(`briefing.cloud.${action}`, payload);
      setData(next);
      return next;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || data?.busy,
    selectedChannel = channel || data?.channel || "email",
    authorized = data?.login?.authenticated,
    waiting = ["starting", "waiting", "authorizing"].includes(
      data?.login?.phase,
    );
  return (
    <div className="cloud-setup">
      <button
        className="button primary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <QrCode size={16} /> {open ? "收起独立开通向导" : "开通我的早晚报"}
      </button>
      {open &&
        createPortal(
          <Modal
            title="开通我的早晚报"
            wide
            onClose={() => {
              setOpen(false);
              setToken("");
              setEmail((old) => ({ ...old, password: "" }));
            }}
          >
            <div className="cloud-setup-body">
              <p className="hint">
                独立云服务支持关机提醒，默认电子邮件，也可选择 PushPlus。
              </p>
              <section className="cloud-setup-step">
                <h4>
                  <span>1</span> 登录自己的腾讯云{" "}
                  {authorized && <Check size={16} />}
                </h4>
                <p className="hint">
                  将打开腾讯云官方浏览器授权页，可选择微信扫码。授权页可能显示“腾讯云命令行工具”；本应用使用其公开授权协议，无需安装命令行工具。临时授权退出应用即清除。
                </p>
                <p role="status">
                  {data?.login?.message || "尚未登录"}
                  {authorized && `（${data.login.account}）`}
                </p>
                <div className="cloud-actions">
                  <button
                    className="button"
                    disabled={locked || waiting}
                    onClick={() => run("login")}
                  >
                    {authorized ? "重新登录腾讯云" : "扫码登录腾讯云"}
                  </button>
                  {(waiting || authorized) && (
                    <button
                      className="text-button"
                      disabled={locked}
                      onClick={() => run("logout")}
                    >
                      {waiting ? "取消登录" : "退出本次授权"}
                    </button>
                  )}
                </div>
              </section>
              <section className="cloud-setup-step">
                <h4>
                  <span>2</span> 选择接收方式{" "}
                  {data?.deliveryConfigured && <Check size={16} />}
                </h4>
                <label>
                  提醒渠道
                  <select
                    value={selectedChannel}
                    disabled={locked}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    <option value="email">电子邮件（默认）</option>
                    <option value="pushplus">PushPlus 微信推送</option>
                  </select>
                </label>
                {selectedChannel === "email" ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await run("bind", { channel: "email", email }))
                        setEmail((old) => ({ ...old, password: "" }));
                    }}
                  >
                    {[
                      ["to", "接收邮箱", "email"],
                      ["user", "发信邮箱", "email"],
                      ["host", "SMTP 主机", "text"],
                      ["password", "客户端授权码", "password"],
                    ].map(([key, label, type]) => (
                      <label key={key}>
                        {label}
                        <input
                          required
                          type={type}
                          autoComplete="off"
                          value={email[key]}
                          onChange={(e) =>
                            setEmail({ ...email, [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      加密端口
                      <select
                        value={email.port}
                        onChange={(e) =>
                          setEmail({ ...email, port: Number(e.target.value) })
                        }
                      >
                        <option value="465">465 · TLS</option>
                        <option value="587">587 · STARTTLS</option>
                      </select>
                    </label>
                    {data?.emailConfigured && (
                      <p role="status">已保存邮箱：{data.emailRecipient}</p>
                    )}
                    <p className="hint">
                      使用自己的邮箱客户端授权码，保存在本机加密配置及本人腾讯云函数中。
                    </p>
                    <button className="button" disabled={locked}>
                      保存邮件接收配置
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="hint">
                      打开
                      pushplus，扫码登录并按页面提示关注接收公众号，再复制你自己的
                      Token。其额度、订阅和推送规则以服务页面为准。
                    </p>
                    <button
                      className="text-button"
                      disabled={locked}
                      onClick={() => run("open", { which: "pushplus" })}
                    >
                      <ExternalLink size={14} /> 打开微信绑定页面
                    </button>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run("bind", { channel: "pushplus", token }))
                          setToken("");
                      }}
                    >
                      <label>
                        我的 pushplus Token
                        <input
                          aria-label="我的 pushplus Token"
                          type="password"
                          autoComplete="new-password"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          placeholder={
                            data?.pushConfigured
                              ? "已加密保存；更换时填写"
                              : "从本人 pushplus 页面复制"
                          }
                        />
                      </label>
                      <button
                        className="button"
                        disabled={locked || !token.trim()}
                      >
                        保存微信接收配置
                      </button>
                    </form>
                  </>
                )}
              </section>
              <section className="cloud-setup-step">
                <h4>
                  <span>3</span> 开通并验证独立服务{" "}
                  {data?.plan?.completedAt && <Check size={16} />}
                </h4>
                <p className="hint">
                  上海区域：1 个私有存储桶、1 个云函数、2
                  个每日定时器及专用角色。执行角色仅能读写本应用的一个快照。云服务按实际存储、调用和流量计费；扫码后如提示实名或服务未开通，请在腾讯云完成。
                </p>
                <label className="cloud-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    disabled={locked}
                  />
                  <span>
                    我确认使用自己的腾讯云并承担其费用；同意上传任务与课表摘要，按北京时间每天
                    08:00、21:00
                    经所选渠道发送。邮件授权码仅部署到本人的云函数。
                  </span>
                </label>
                <button
                  className="button primary"
                  disabled={
                    locked ||
                    !consent ||
                    !authorized ||
                    !data?.deliveryConfigured ||
                    selectedChannel !== data?.channel
                  }
                  onClick={() => run("deploy", { consent })}
                >
                  {data?.busy
                    ? "正在开通与核验…"
                    : data?.plan
                      ? "继续开通 / 重新核验"
                      : "确认并开通我的云提醒"}
                </button>
                <p className="cloud-setup-status" role="status">
                  {data?.message}
                </p>
                {data?.plan && (
                  <details>
                    <summary>我的云资源与后续管理</summary>
                    <p className="hint">
                      账号 APPID：{data.plan.appId}
                      <br />
                      函数：{data.plan.functionName}
                      <br />
                      存储桶：{data.plan.bucket}
                      <br />
                      角色：{data.plan.roleName}
                      <br />
                      策略：{data.plan.policyName}
                    </p>
                    <p className="hint">
                      中断后可登录同一账号继续。停止本机同步或卸载软件不会停止云端定时器；停用时请在云函数控制台关闭两个定时器，长期停用再按需删除这些专用资源。
                    </p>
                    <div className="cloud-actions">
                      {[
                        ["scf", "管理云函数"],
                        ["cos", "管理存储"],
                        ["cam", "管理权限"],
                        ["billing", "查看账单"],
                      ].map(([which, label]) => (
                        <button
                          key={which}
                          className="text-button"
                          onClick={() => run("open", { which })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                {data?.plan?.completedAt && (
                  <div className="cloud-actions">
                    <button
                      className="button"
                      disabled={locked || !authorized}
                      onClick={() => run("test")}
                    >
                      发送一条测试提醒
                    </button>
                    <button
                      className="button"
                      disabled={locked}
                      onClick={() => run("received")}
                    >
                      已收到
                    </button>
                  </div>
                )}
                {data?.receivedAt && (
                  <p className="hint">
                    本人确认测试送达：
                    {new Date(data.receivedAt).toLocaleString("zh-CN")}
                    。自然定时送达请在后续晨晚报核对。
                  </p>
                )}
              </section>
              {(error || data?.warning) && (
                <p className="error" role="alert">
                  {error || data.warning}
                </p>
              )}
            </div>
          </Modal>,
          document.body,
        )}
    </div>
  );
}
