import { defineWidget } from "../../sdk/widget.mjs";
import React, { useState, useEffect } from "react";
import { NotebookPen, Check, Trash2, Undo2 } from "lucide-react";
function QuickNote({ config, actions }) {
  const [text, setText] = useState(config.text || ""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setText(config.text || "");
  }, [config.text]);
  return (
    <section className="panel note-widget">
      <div className="panel-heading">
        <div className="inline">
          <NotebookPen size={18} />
          <h3>随手记</h3>
        </div>
        <span className="pill">灵感留白</span>
      </div>
      <textarea
        aria-label="随手记内容"
        placeholder="留一句提醒自己的话，或一个刚冒出来的想法…"
        maxLength={3000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <div className="note-footer">
        <button
          className="text-button danger"
          disabled={busy || !text}
          onClick={async () => {
            setBusy(true);
            try {
              await actions.configure({
                ...config,
                text: "",
                deletedText: text,
              });
              setText("");
              setSaved(false);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 size={14} />
          删除便笺
        </button>
        {config.deletedText && (
          <button
            className="text-button"
            disabled={busy || !!text}
            onClick={async () => {
              setBusy(true);
              try {
                await actions.configure({
                  ...config,
                  text: config.deletedText,
                  deletedText: "",
                });
                setText(config.deletedText);
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Undo2 size={14} />
            恢复便笺
          </button>
        )}
        <small>{error || "保存在本机；需要提醒的事项请加入任务。"}</small>
        <button
          className="button small"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await actions.configure({ ...config, text });
              setSaved(true);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {saved ? (
            <>
              <Check size={14} />
              已保存
            </>
          ) : (
            "保存便笺"
          )}
        </button>
      </div>
    </section>
  );
}
// A real optional extension using only its own namespaced storage.
export default defineWidget({
  id: "quick-note",
  title: "随手记",
  description: "记录灵感与短便笺，保存后下次继续。",
  apiVersion: 1,
  stateVersion: 1,
  version: "1.0.0",
  data: [],
  commands: [],
  uiActions: [],
  defaultSize: "half",
  defaults: { text: "" },
  Component: QuickNote,
});
