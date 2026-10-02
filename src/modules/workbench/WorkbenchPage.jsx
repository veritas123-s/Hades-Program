import Panel from "../../shared/Panel.jsx";
import React, { useState } from "react";
import {
  Check,
  ArrowUp,
  ArrowDown,
  Palette,
  Blocks,
  RotateCcw,
  Plus,
  EyeOff,
} from "lucide-react";
import { THEMES } from "../../themes/catalog.mjs";
import { registry } from "../../platform/modules.jsx";
import ThemeEditor from "./ThemeEditor.jsx";
import { WALLPAPERS } from "../../themes/wallpapers.mjs";
import { defaultAppearance } from "../../themes/custom.mjs";
import { customWidgetIds } from "../../platform/widget-recipes.mjs";
export default function WorkbenchPage({ state, call }) {
  const [section, setSection] = useState("themes");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const workspace = state.workspace;
  const catalog = new Map(registry.widgets);
  for (const id of customWidgetIds(workspace))
    catalog.set(id, {
      id,
      title: workspace.widgetData[id].data.title,
      description:
        workspace.widgetData[id].data.kind === "countdown"
          ? "你的重要日倒计时"
          : "你的打卡检查表",
      defaultSize: "half",
      moduleId: "personal",
    });
  const update = async (patch) => {
    setBusy(true);
    setError("");
    try {
      await call("workspace.configure", patch);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const ordered = [
    ...workspace.widgets.order.filter((id) => catalog.has(id)),
    ...[...catalog.keys()].filter(
      (id) => !workspace.widgets.order.includes(id),
    ),
  ].filter(
    (id) =>
      !["courses", "priority"].includes(id) ||
      workspace.widgetData[id]?.data.explicitlyAdded,
  );
  const visible = workspace.widgets.order.filter(
    (id) =>
      catalog.has(id) &&
      (!["courses", "priority"].includes(id) ||
        workspace.widgetData[id]?.data.explicitlyAdded) &&
      !workspace.widgetData[id]?.data.deletedAt &&
      !workspace.widgets.hidden.includes(id),
  );
  const toggle = (id) => {
    if (workspace.widgetData[id]?.data.deletedAt) {
      call("widget.restore", { id }).catch(() => {});
      return;
    }
    const active = visible.includes(id);
    update({
      widgets: {
        order: workspace.widgets.order.includes(id)
          ? workspace.widgets.order
          : [...workspace.widgets.order, id],
        hidden: active
          ? [...workspace.widgets.hidden, id]
          : workspace.widgets.hidden.filter((x) => x !== id),
      },
    });
  };
  const move = (id, delta) => {
    const order = [...workspace.widgets.order],
      index = order.indexOf(id),
      targetId = visible[visible.indexOf(id) + delta];
    if (!targetId) return;
    const target = order.indexOf(targetId);
    [order[index], order[target]] = [order[target], order[index]];
    update({ widgets: { order } });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>主题与小组件</h1>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="tabs" aria-label="外观与组件分类">
        {[
          ["themes", "主题"],
          ["custom", "背景与配色"],
          ["widgets", "小组件"],
          ["modules", "模块"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={section === id ? "active" : ""}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {section === "themes" && (
        <Panel className="panel theme-section">
          <div className="panel-heading">
            <div className="inline">
              <Palette size={19} />
              <h2>主题</h2>
            </div>
          </div>
          <div className="theme-gallery">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                className={`theme-choice ${workspace.theme === theme.id ? "selected" : ""}`}
                aria-pressed={workspace.theme === theme.id}
                aria-label={`使用${theme.name}主题`}
                disabled={busy}
                onClick={() =>
                  update({ theme: theme.id, appearance: defaultAppearance() })
                }
              >
                <div
                  className={`theme-preview theme-preview-${theme.id} ${WALLPAPERS[theme.id] ? "has-art" : ""}`}
                  style={{
                    "--preview-bg": theme.colors[2],
                    "--preview-side": theme.colors[0],
                    "--preview-accent": theme.colors[1],
                    "--preview-art": WALLPAPERS[theme.id]
                      ? `url("${WALLPAPERS[theme.id]}")`
                      : "none",
                  }}
                >
                  <span />
                  <div>
                    <i />
                    <div>
                      <b />
                      <b />
                    </div>
                    <em />
                  </div>
                </div>
                <div className="theme-name">
                  <h3>{theme.name}</h3>
                  {workspace.theme === theme.id && <Check size={17} />}
                </div>
              </button>
            ))}
          </div>
        </Panel>
      )}
      {section === "custom" && (
        <ThemeEditor {...{ workspace, call, update, busy }} />
      )}
      {section === "widgets" && (
        <Panel className="panel widget-library">
          <div className="panel-heading">
            <div className="inline">
              <Blocks size={19} />
              <div>
                <h2>小组件库</h2>
              </div>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await call("workspace.reset");
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <RotateCcw size={14} />
              恢复默认布局
            </button>
          </div>
          <div className="widget-catalog">
            {ordered.map((id) => {
              const item = catalog.get(id),
                active = visible.includes(id),
                index = visible.indexOf(id);
              return (
                <div
                  className={`widget-catalog-row ${active ? "enabled" : ""}`}
                  key={id}
                  data-widget-option={id}
                >
                  <span className="widget-order">
                    {active ? String(index + 1).padStart(2, "0") : "＋"}
                  </span>
                  <div className="widget-description">
                    <h3>{item.title}</h3>
                    <small>
                      {active ? "已在首页" : "尚未展示"}
                      {item.moduleId === "extensions" ? " · 扩展小组件" : ""}
                    </small>
                  </div>
                  <div className="widget-controls">
                    {active && (
                      <>
                        <select
                          aria-label={`${item.title}宽度`}
                          disabled={busy}
                          value={
                            workspace.widgets.sizes[id] ||
                            item.defaultSize ||
                            "half"
                          }
                          onChange={(e) =>
                            update({
                              widgets: {
                                sizes: {
                                  ...workspace.widgets.sizes,
                                  [id]: e.target.value,
                                },
                              },
                            })
                          }
                        >
                          <option value="half">半宽</option>
                          <option value="full">整行</option>
                        </select>
                        <button
                          className="icon-button"
                          aria-label={`上移${item.title}`}
                          disabled={busy || index === 0}
                          onClick={() => move(id, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`下移${item.title}`}
                          disabled={busy || index === visible.length - 1}
                          onClick={() => move(id, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </>
                    )}
                    <button
                      className={`button small ${active ? "" : "primary"}`}
                      aria-label={`${active ? "隐藏" : "添加"}${item.title}`}
                      disabled={busy}
                      onClick={() => toggle(id)}
                    >
                      {active ? (
                        <>
                          <EyeOff size={14} />
                          隐藏
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          添加
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
      {section === "modules" && (
        <Panel className="panel module-library">
          <h2>已装入的功能</h2>
          <div className="module-chips">
            {registry.modules.map((module) => (
              <div key={module.id}>
                <strong>{module.title}</strong>
              </div>
            ))}
          </div>
          {registry.issues.length > 0 && (
            <p role="alert" className="error">
              有 {registry.issues.length} 个扩展暂不兼容，其他功能可继续使用。
            </p>
          )}
        </Panel>
      )}
    </>
  );
}
