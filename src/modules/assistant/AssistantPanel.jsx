import Panel from "../../shared/Panel.jsx";
import React, { useEffect, useState, useRef } from "react";
import {
  Sparkles,
  X,
  Send,
  Settings2,
  ShieldCheck,
  RefreshCw,
  Plus,
  Check,
  Square,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { QUADRANTS } from "../../domain.mjs";
import { ASSISTANT_API } from "../../assistant.mjs";

function DraftBatch({ entry, run, busy, onBriefing }) {
  const [drafts, setDrafts] = useState(() =>
    entry.tasks.map((t) => ({ ...t, selected: !t.added })),
  );
  const [result, setResult] = useState("");
  const field = (index, key, value) =>
    setDrafts((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  const pending = drafts.filter(
    (t) =>
      t.selected &&
      !entry.tasks.find((e) => e.draftIndex === t.draftIndex)?.added,
  );
  return (
    <div className="ai-drafts">
      <div className="ai-drafts-title">
        <strong>任务草稿 · 核对后加入清单</strong>
        <small>北京时间</small>
      </div>
      {drafts.map((task, index) => {
        const added = entry.tasks.find(
          (t) => t.draftIndex === task.draftIndex,
        )?.added;
        return (
          <Panel
            className={`ai-draft ${added ? "is-added" : ""}`}
            key={task.draftIndex}
            data-draft={task.draftIndex}
          >
            <label className="ai-draft-select">
              <input
                type="checkbox"
                aria-label={`选择任务 ${index + 1}`}
                checked={added || task.selected}
                disabled={added || busy}
                onChange={(e) => field(index, "selected", e.target.checked)}
              />
              <span>{added ? "已加入清单" : `任务 ${index + 1}`}</span>
              {added && <Check size={15} />}
            </label>
            <input
              aria-label={`草稿任务名称 ${index + 1}`}
              value={task.title}
              maxLength={300}
              disabled={added || busy}
              onChange={(e) => field(index, "title", e.target.value)}
            />
            <div className="ai-draft-fields">
              <label>
                截止日期
                <input
                  type="date"
                  aria-label={`草稿截止日期 ${index + 1}`}
                  value={task.due}
                  disabled={added || busy}
                  onChange={(e) => field(index, "due", e.target.value)}
                />
              </label>
              <label>
                截止钟点
                <input
                  type="time"
                  aria-label={`草稿截止钟点 ${index + 1}`}
                  value={task.dueTime}
                  disabled={added || busy}
                  onChange={(e) => field(index, "dueTime", e.target.value)}
                />
              </label>
              <label>
                四象限
                <select
                  aria-label={`草稿四象限 ${index + 1}`}
                  value={task.quadrant}
                  disabled={added || busy}
                  onChange={(e) => field(index, "quadrant", e.target.value)}
                >
                  {QUADRANTS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.subtitle}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                所属清单
                <input
                  aria-label={`草稿清单 ${index + 1}`}
                  value={task.project}
                  maxLength={60}
                  disabled={added || busy}
                  onChange={(e) => field(index, "project", e.target.value)}
                />
              </label>
            </div>
            <details>
              <summary>步骤、备注与预计时间</summary>
              <label>
                预计分钟
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={task.estimate}
                  disabled={added || busy}
                  onChange={(e) => field(index, "estimate", e.target.value)}
                />
              </label>
              <label>
                重复
                <select
                  value={task.repeat}
                  disabled={added || busy}
                  onChange={(e) => field(index, "repeat", e.target.value)}
                >
                  <option value="none">不重复</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                </select>
              </label>
              <label>
                子任务（每行一项）
                <textarea
                  value={task.subtasks.map((s) => s.title).join("\n")}
                  disabled={added || busy}
                  onChange={(e) =>
                    field(
                      index,
                      "subtasks",
                      e.target.value.split("\n").map((title) => ({ title })),
                    )
                  }
                />
              </label>
              <label>
                备注
                <textarea
                  value={task.notes}
                  disabled={added || busy}
                  onChange={(e) => field(index, "notes", e.target.value)}
                />
              </label>
            </details>
          </Panel>
        );
      })}
      <p className="hint">
        保存后自动纳入早晚报：未来 3
        天到期、逾期及重要任务。微信采用最近成功同步的状态。
      </p>
      <div className="ai-batch-actions">
        <button
          className="button primary"
          disabled={busy || !pending.length}
          onClick={async () => {
            const data = await run("assistant.commit", {
              id: entry.id,
              tasks: pending,
            });
            if (data)
              setResult(
                `已添加 ${data.commit.added} 项任务${data.commit.skipped ? "，已添加的项目未重复创建" : ""}`,
              );
          }}
        >
          <Plus size={15} />
          添加 {pending.length} 项任务
        </button>
        <button className="text-button" onClick={onBriefing}>
          查看早晚报 <ArrowUpRight size={14} />
        </button>
      </div>
      {result && (
        <p className="ai-success" role="status">
          {result}
        </p>
      )}
    </div>
  );
}
export default function AssistantPanel({
  open,
  onClose,
  call,
  state,
  onBriefing,
  onManual,
}) {
  const [data, setData] = useState(null),
    [text, setText] = useState(""),
    [routing, setRouting] = useState("auto"),
    [includeContext, setIncludeContext] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [config, setConfig] = useState(false),
    [endpoint, setEndpoint] = useState(ASSISTANT_API),
    [model, setModel] = useState("deepseek-chat"),
    [key, setKey] = useState(""),
    [confirmClear, setConfirmClear] = useState(false);
  const input = useRef(null),
    body = useRef(null);
  const run = async (action, payload = {}) => {
    setBusy(true);
    setError("");
    try {
      const next = await call(action, payload);
      setData(next);
      return next;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (data) {
      setEndpoint(data.endpoint);
      setModel(data.model);
    }
  }, [data?.endpoint, data?.model]);
  useEffect(() => {
    if (open) {
      call("assistant.state")
        .then(setData)
        .catch((e) => setError(e.message));
      input.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (open)
      body.current?.scrollTo({
        top: body.current.scrollHeight,
        behavior: "smooth",
      });
  }, [data?.history?.length]);
  useEffect(() => {
    if (!open) return;
    const escape = (e) => {
      if (e.key === "Escape") {
        onClose();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open, onClose]);
  // Refresh completion badges when task edits arrive from another module.
  useEffect(() => {
    if (open && !busy)
      call("assistant.state")
        .then(setData)
        .catch(() => {});
  }, [state.tasks.length]);
  async function send(e) {
    e?.preventDefault();
    const prompt = text.trim();
    if (!prompt || busy) return;
    const next = await run("assistant.chat", {
      text: prompt,
      includeContext,
      model: routing,
    });
    if (next) setText("");
  }
  return (
    <aside
      className="assistant-dock"
      hidden={!open}
      role="dialog"
      aria-modal="false"
      aria-label="Poseidon 嵌入式助手"
    >
      <header className="ai-header">
        <div className="ai-emblem">
          <Sparkles size={21} />
        </div>
        <div>
          <h2>Poseidon</h2>
          <small>任务与学习助手</small>
        </div>
        <button
          className="icon-button"
          aria-label="助手连接设置"
          onClick={() => setConfig(!config)}
        >
          <Settings2 size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="关闭 AI 助手"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      <div className="ai-connection">
        <ShieldCheck size={13} />
        <span>
          {data?.configured
            ? `${data.model || "待选择模型"} · ${data.endpoint.replace(/^https?:\/\//, "").split("/")[0]}`
            : "等待配置自己的 API"}
        </span>
        <button
          className="text-button"
          onClick={() => setConfirmClear(!confirmClear)}
          disabled={busy}
        >
          <Trash2 size={12} />
          清空对话
        </button>
      </div>
      {confirmClear && (
        <div className="ai-confirm">
          <p>清空本机对话与未添加草稿？已经加入清单的任务会保留。</p>
          <button
            className="button small"
            onClick={async () => {
              if (await run("assistant.clear")) setConfirmClear(false);
            }}
          >
            确认清空对话
          </button>
          <button
            className="text-button"
            onClick={() => setConfirmClear(false)}
          >
            取消
          </button>
        </div>
      )}
      {(config || (data && !data.configured)) && (
        <Panel className="ai-config">
          <h3>模型连接 · 使用自己的 API</h3>
          <p className="hint">
            支持兼容 OpenAI 的 Chat Completions 接口。密钥用 Windows
            加密保存在本机；交大接口需要校园网或 VPN。
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setConfig(true);
              if (
                await run("assistant.configure", {
                  endpoint,
                  model: model.trim(),
                  ...(key.trim() ? { key: key.trim() } : {}),
                })
              ) {
                setKey("");
                await run("assistant.models");
              }
            }}
          >
            <label>
              API 地址（Base URL）
              <input
                aria-label="API 地址"
                type="url"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="https://服务地址/v1"
                spellCheck={false}
              />
            </label>
            <label>
              API 密钥
              <input
                type="password"
                aria-label="API 密钥"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={
                  data?.configured
                    ? "已加密保存；输入新密钥可替换"
                    : "粘贴你自己的 API 密钥"
                }
              />
            </label>
            <label>
              默认模型调用名（可手动填写）
              <input
                aria-label="模型调用名"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="按服务提供方填写，或留空后刷新模型"
                list="assistant-model-options"
                spellCheck={false}
              />
              <datalist id="assistant-model-options">
                {(data?.models || []).map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </label>
            <small>
              更换服务地址时，请同时填写该服务的密钥；同一服务留空则保留已保存的密钥。
            </small>
            <button
              className="button small primary"
              disabled={
                busy || !endpoint.trim() || (!data?.configured && !key.trim())
              }
            >
              保存并检查连接
            </button>
          </form>
          {data?.configured && (
            <>
              <label>
                从接口列表选择模型
                <select
                  aria-label="助手模型"
                  value={data.model}
                  disabled={busy}
                  onChange={(e) =>
                    run("assistant.configure", { model: e.target.value })
                  }
                >
                  {[...new Set([data.model, ...data.models])].map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ai-config-actions">
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => run("assistant.models")}
                >
                  <RefreshCw size={13} />
                  刷新可用模型
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => run("assistant.forget")}
                >
                  移除本机密钥
                </button>
              </div>
            </>
          )}
        </Panel>
      )}
      {(error || data?.warning) && (
        <div className="ai-error" role="alert">
          {error || data.warning}
        </div>
      )}
      <div className="ai-history" ref={body}>
        {!data?.history.length && (
          <div className="ai-welcome">
            <span className="eyebrow">随时讨论，随手安排</span>
            <h3>想到什么，就从这里开始。</h3>
            <p>
              一次说出多个事项，我会整理成任务卡片。你可以修改日期、清单和优先级，再一起添加。
            </p>
            <div className="ai-starters">
              {[
                "帮我整理未来三天要完成的任务",
                "帮我添加：明天18点前提交实验报告，重要且紧急",
                "根据已同步的课表，帮我拟一份明天的学习计划",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setText(prompt);
                    input.current?.focus();
                  }}
                >
                  {prompt}
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
            <button className="text-button" onClick={onManual}>
              也可以直接手动添加任务 <Plus size={14} />
            </button>
          </div>
        )}
        {data?.history.map((entry) => (
          <article className="ai-exchange" key={entry.id}>
            <div className="ai-user-message">{entry.user}</div>
            <div className="ai-reply">
              <div className="ai-reply-label">
                <Sparkles size={13} />
                POSEIDON · {entry.model || data?.model}
              </div>
              <div className="ai-prose">{entry.reply}</div>
              {(entry.warnings || []).map((warning, i) => (
                <p className="hint" key={i}>
                  {warning}
                </p>
              ))}
            </div>
            {entry.tasks.length > 0 && (
              <DraftBatch
                entry={entry}
                run={run}
                busy={busy}
                onBriefing={onBriefing}
              />
            )}
          </article>
        ))}
        {busy && (
          <p className="ai-working" role="status">
            正在处理，请稍候…
          </p>
        )}
      </div>
      <form className="ai-composer" onSubmit={send}>
        <label>
          本次模型
          <select
            aria-label="本次模型"
            value={routing}
            onChange={(e) => setRouting(e.target.value)}
          >
            <option value="auto">自动选择（按问题类型）</option>
            <option value="default">默认：{data?.model}</option>
            {(data?.models || []).map((id) => (
              <option value={id} key={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="ai-context">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
          />
          附带任务与课表摘要
        </label>
        <small>
          只发送必要字段；不发送账号、会话、成绩和任务长笔记。对话保留在本机。
        </small>
        <textarea
          aria-label="对助手说"
          ref={input}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入想法、任务或问题…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div>
          <small>Ctrl + Enter 发送</small>
          {busy ? (
            <button
              type="button"
              className="button"
              onClick={() =>
                call("assistant.cancel")
                  .then(setData)
                  .catch((e) => setError(e.message))
              }
            >
              <Square size={14} />
              停止生成
            </button>
          ) : (
            <button className="button primary" disabled={!text.trim()}>
              <Send size={14} />
              发送
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}
