import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import {
  ImagePlus,
  Trash2,
  RotateCcw,
  Save,
  Undo2,
  Pencil,
} from "lucide-react";
import { THEMES, themeById } from "../../themes/catalog.mjs";
import { defaultAppearance } from "../../themes/custom.mjs";
export default function ThemeEditor({ workspace, call, update, busy }) {
  const [name, setName] = useState("我的主题"),
    [editing, setEditing] = useState(""),
    [base, setBase] = useState("paper"),
    [colors, setColors] = useState({
      accent: "#7656a8",
      background: "#f0e9fa",
      surface: "#fbf8ff",
      text: "#342644",
    }),
    [error, setError] = useState("");
  const a = workspace.appearance;
  const run = async (fn) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };
  const edit = (t) => {
    setName(t.name);
    setEditing(t.id);
    setBase(t.base);
    setColors(t.colors);
  };
  return (
    <Panel className="panel theme-editor">
      <h2>背景图与自定义主题</h2>
      <div className="theme-editor-grid">
        <div>
          <div
            className="background-preview"
            role="img"
            aria-label="当前背景图预览"
          />
          <div className="inline" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="button"
              disabled={busy}
              onClick={() => run(() => call("background.import"))}
            >
              <ImagePlus size={16} />
              选择背景图
            </button>
            <button
              className="button"
              disabled={busy || a.image === "none"}
              onClick={() => update({ appearance: { image: "none" } })}
            >
              <Trash2 size={15} />
              移除背景图
            </button>
            <button
              className="text-button"
              onClick={() => update({ appearance: defaultAppearance() })}
            >
              <RotateCcw size={14} />
              恢复主题图画
            </button>
          </div>
          <label>
            背景浓度 {a.opacity}%
            <input
              aria-label="背景浓度"
              type="range"
              min="0"
              max="60"
              value={a.opacity}
              onChange={(e) =>
                update({ appearance: { opacity: Number(e.target.value) } })
              }
            />
          </label>
          <label>
            背景模糊 {a.blur}px
            <input
              aria-label="背景模糊"
              type="range"
              min="0"
              max="16"
              value={a.blur}
              onChange={(e) =>
                update({ appearance: { blur: Number(e.target.value) } })
              }
            />
          </label>
          <div className="inline">
            <label>
              图片布局
              <select
                aria-label="图片布局"
                value={a.fit}
                onChange={(e) =>
                  update({ appearance: { fit: e.target.value } })
                }
              >
                <option value="cover">铺满</option>
                <option value="contain">完整显示</option>
              </select>
            </label>
            <label>
              图片位置
              <select
                aria-label="图片位置"
                value={a.position}
                onChange={(e) =>
                  update({ appearance: { position: e.target.value } })
                }
              >
                {[
                  ["center", "居中"],
                  ["top", "顶部"],
                  ["bottom", "底部"],
                  ["left", "左侧"],
                  ["right", "右侧"],
                ].map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const id = editing || "custom-" + crypto.randomUUID();
              const record = {
                id,
                name,
                base,
                colors,
                appearance: a,
                deletedAt: null,
              };
              const success = await update({
                customThemes: [
                  ...workspace.customThemes.filter((t) => t.id !== id),
                  record,
                ],
                theme: id,
              });
              if (success) setEditing(id);
            });
          }}
        >
          <label>
            主题名称
            <input
              aria-label="自定义主题名称"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            基础风格
            <select
              aria-label="基础风格"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="color-controls">
            {[
              ["accent", "强调色"],
              ["background", "背景色"],
              ["surface", "卡片色"],
              ["text", "文字色"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  aria-label={label}
                  type="color"
                  value={colors[key]}
                  onChange={(e) =>
                    setColors({ ...colors, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="inline">
            <button className="button primary" disabled={busy}>
              <Save size={15} />
              {editing ? "更新我的主题" : "保存为我的主题"}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditing("");
                  setName("新的主题");
                }}
              >
                另存新主题
              </button>
            )}
          </div>
        </form>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <h3>我的主题</h3>
      {!workspace.customThemes.filter((t) => !t.deletedAt).length && (
        <p className="hint">暂无自定义主题</p>
      )}
      {workspace.customThemes
        .filter((t) => !t.deletedAt)
        .map((t) => (
          <div className="custom-theme-row" key={t.id}>
            <div className="inline">
              <i
                className="custom-theme-swatch"
                style={{ background: t.colors.accent }}
              />
              <b>{t.name}</b>
              <small>{themeById(t.base).name}</small>
            </div>
            <div className="inline">
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  update({ theme: t.id, appearance: t.appearance })
                }
              >
                使用{t.name}
              </button>
              <button
                className="icon-button"
                aria-label={"编辑主题 " + t.name}
                onClick={() => edit(t)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={"删除主题 " + t.name}
                onClick={() =>
                  update({
                    customThemes: workspace.customThemes.map((x) =>
                      x.id === t.id ? { ...x, deletedAt: Date.now() } : x,
                    ),
                    ...(workspace.theme === t.id
                      ? { theme: t.base, appearance: defaultAppearance() }
                      : {}),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      {workspace.customThemes.some((t) => t.deletedAt) && (
        <details>
          <summary>已删除的主题</summary>
          {workspace.customThemes
            .filter((t) => t.deletedAt)
            .map((t) => (
              <div className="custom-theme-row" key={t.id}>
                <span>{t.name}</span>
                <button
                  className="button small"
                  onClick={() =>
                    update({
                      customThemes: workspace.customThemes.map((x) =>
                        x.id === t.id ? { ...x, deletedAt: null } : x,
                      ),
                    })
                  }
                >
                  <Undo2 size={14} />
                  恢复主题
                </button>
              </div>
            ))}
        </details>
      )}
    </Panel>
  );
}
