import React, { useState } from "react";
import { Pencil, Trash2, Undo2, Plus } from "lucide-react";
import { Modal } from "../components.jsx";
export default function ListManager({ state, call, onClose }) {
  const [name, setName] = useState(""),
    [editing, setEditing] = useState(""),
    [pending, setPending] = useState(null),
    [withTasks, setWithTasks] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (action, p) => {
    setBusy(true);
    setError("");
    try {
      await call(action, p);
      setPending(null);
      setName("");
      setEditing("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="管理清单" onClose={onClose} wide>
      <p className="hint">
        清单可以单独创建、重命名和删除。删除后可恢复；默认把任务保留在收集箱。
      </p>
      {pending ? (
        <div className="delete-review">
          <h3>
            {pending.name === "收集箱" ? "清空收集箱" : `删除“${pending.name}”`}
          </h3>
          <p>
            {
              state.tasks.filter(
                (t) => t.project === pending.name && !t.deletedAt,
              ).length
            }{" "}
            项任务受影响。已记录的专注时长不会改变。
          </p>
          <label className="inline">
            <input
              type="checkbox"
              checked={withTasks}
              disabled={pending.name === "收集箱"}
              onChange={(e) => setWithTasks(e.target.checked)}
            />
            同时将清单里的任务移至回收站
          </label>
          <p className="hint">
            未勾选时，任务保留并移到收集箱。收集箱本身是默认入口，只清空任务。
          </p>
          <div className="inline">
            <button className="button" onClick={() => setPending(null)}>
              取消删除
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => run("list.delete", { id: pending.id, withTasks })}
            >
              确认删除
            </button>
          </div>
        </div>
      ) : (
        <>
          <form
            className="inline list-create"
            onSubmit={(e) => {
              e.preventDefault();
              run("list.save", { id: editing || undefined, name });
            }}
          >
            <input
              aria-label="清单名称"
              placeholder="清单名称"
              value={name}
              maxLength={60}
              required
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button primary" disabled={busy}>
              <Plus size={15} />
              {editing ? "保存清单名称" : "创建清单"}
            </button>
          </form>
          {state.lists
            .filter((l) => !l.deletedAt)
            .map((l) => (
              <div className="content-manager-row" key={l.id}>
                <div>
                  <b>{l.name}</b>
                  <small>
                    {
                      state.tasks.filter(
                        (t) => t.project === l.name && !t.deletedAt,
                      ).length
                    }{" "}
                    项任务
                  </small>
                </div>
                <div className="inline">
                  {l.name !== "收集箱" && (
                    <button
                      className="icon-button"
                      aria-label={"重命名清单 " + l.name}
                      onClick={() => {
                        setEditing(l.id);
                        setName(l.name);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={
                      l.name === "收集箱" ? "清空收集箱" : "删除清单 " + l.name
                    }
                    disabled={busy}
                    onClick={() => {
                      setPending(l);
                      setWithTasks(l.name === "收集箱");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          {state.lists.some((l) => l.deletedAt) && (
            <details>
              <summary>已删除的清单</summary>
              <p className="hint">
                恢复清单名称；已转移或删除的任务保持现状，可在任务回收站单独恢复。
              </p>
              {state.lists
                .filter((l) => l.deletedAt)
                .map((l) => (
                  <div className="content-manager-row" key={l.id}>
                    <span>{l.name}</span>
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => run("list.restore", { id: l.id })}
                    >
                      <Undo2 size={14} />
                      恢复清单
                    </button>
                  </div>
                ))}
            </details>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
