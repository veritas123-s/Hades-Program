import React, { useState } from "react";
import Panel from "../../shared/Panel.jsx";
export default function WorkflowSettings({ state, call }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (action, p) => {
    setBusy(true);
    setError("");
    try {
      await call(action, p);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Panel
        className="panel workflow-panel"
        title="自动工作流"
        defaultCollapsed
      >
        <h2>Poseidon 工作流</h2>
        <p>以下操作在本机完成。已入库的任务沿用现有早晚报同步通道。</p>
        <label>
          <input
            type="checkbox"
            checked={state.workflows?.autoImport ?? true}
            onChange={(e) =>
              run("workflow.configure", { autoImport: e.target.checked })
            }
          />{" "}
          学习通未交作业自动加入任务清单
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.workflows?.autoCommit ?? false}
            onChange={(e) =>
              run("workflow.configure", { autoCommit: e.target.checked })
            }
          />{" "}
          授予自动建任务权限：明确说“添加 / 创建 / 安排”后直接保存助手草稿
        </label>
        <small>
          默认先核对草稿。此权限不包含删除历史记录、提交作业或发送消息。可在下方撤销自动添加的未完成任务，任务进入回收站。
        </small>
        <h3>最近执行</h3>
        {(state.workflows?.audit || []).slice(0, 10).map((x) => (
          <div className="workflow-entry" key={x.id}>
            <span>
              {x.kind} · {x.ids.length} 项{" "}
              <small>{new Date(x.at).toLocaleString("zh-CN")}</small>
            </span>
            <button
              className="text-button"
              disabled={x.undone || busy}
              onClick={() => run("workflow.undo", { id: x.id })}
            >
              {x.undone ? "已撤销" : "撤销新增"}
            </button>
          </div>
        ))}
        {!state.workflows?.audit?.length && (
          <p className="hint">暂无自动执行记录。</p>
        )}
      </Panel>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
