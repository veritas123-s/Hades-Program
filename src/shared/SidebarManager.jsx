import React from "react";
import { Eye, EyeOff, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

export default function SidebarManager({ nav, workspace, call, onClose }) {
  const navigation = workspace.navigation || { collapsed: false, hidden: [] };
  const hidden = new Set(navigation.hidden);
  const configure = (patch) =>
    call("workspace.configure", { navigation: { ...navigation, ...patch } });
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="整理侧栏"
    >
      <section className="modal sidebar-manager">
        <header>
          <div>
            <p className="eyebrow">导航偏好</p>
            <h2>整理侧栏</h2>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <button
          className="sidebar-mode"
          onClick={() => configure({ collapsed: !navigation.collapsed })}
        >
          {navigation.collapsed ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
          <span>
            <b>{navigation.collapsed ? "展开侧栏" : "仅显示三大板块"}</b>
            <small>随时可从侧栏底部切换回来</small>
          </span>
        </button>
        <div className="sidebar-options">
          {nav.map(([id, label, Icon]) => {
            const fixed = id === "today";
            const visible = !hidden.has(id);
            return (
              <button
                key={id}
                disabled={fixed}
                onClick={() =>
                  configure({
                    hidden: visible
                      ? [...hidden, id]
                      : [...hidden].filter((value) => value !== id),
                  })
                }
              >
                <Icon size={18} />
                <span>{label}</span>
                {visible ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            );
          })}
        </div>
        <p className="hint">
          “今日概览”和“设置”始终保留，隐藏功能不会删除其中的数据。
        </p>
      </section>
    </div>
  );
}
