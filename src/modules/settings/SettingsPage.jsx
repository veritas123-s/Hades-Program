import WorkflowSettings from "./WorkflowSettings.jsx";
import UpdateCenter from "./UpdateCenter.jsx";
import React, { useState } from "react";
import { Download, Upload, FolderOpen } from "lucide-react";
import { APP_LABEL } from "../../version.mjs";
import Panel from "../../shared/Panel.jsx";
import LinkedText from "../../shared/LinkedText.jsx";
export default function SettingsPage({
  state,
  call,
  toast,
  setPage,
  openManual,
  startTour,
  openSidebarManager,
}) {
  const [settings, setSettings] = useState(state.settings),
    [saving, setSaving] = useState(false),
    [tab, setTab] = useState("focus");
  const tabs = [
    ["focus", "专注与提醒"],
    ["appearance", "界面"],
    ["account", "账号"],
    ["data", "数据"],
    ["help", "帮助"],
    ["updates", "版本更新"],
    ["about", "关于"],
  ];
  return (
    <>
      <div className="page-heading">
        <h1>设置</h1>
        <span className="version">{APP_LABEL}</span>
      </div>
      <div className="settings-layout">
        <nav className="settings-tabs" role="tablist" aria-label="设置分类">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              id={`settings-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`settings-content-${id}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div
          className="settings-content"
          role="tabpanel"
          id={`settings-content-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
        >
          <div hidden={tab !== "focus"}>
            <Panel className="panel" title="专注与提醒">
              <h2>专注与提醒</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  try {
                    await call("settings", settings);
                    toast("设置已保存");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="form-grid">
                  {[
                    ["focusMinutes", "番茄专注", 180],
                    ["shortMinutes", "短休息", 60],
                    ["longMinutes", "长休息", 120],
                    ["dailyGoal", "每日专注目标", 1440],
                  ].map(([id, label, max]) => (
                    <label key={id}>
                      {label}（分钟）
                      <input
                        type="number"
                        min="1"
                        max={max}
                        required
                        value={settings[id]}
                        onChange={(e) =>
                          setSettings((s) => ({ ...s, [id]: e.target.value }))
                        }
                      />
                    </label>
                  ))}
                </div>
                {[
                  ["notifications", "系统通知"],
                  ["sound", "通知声音"],
                  ["closeToTray", "关闭窗口时收起到托盘"],
                ].map(([id, label]) => (
                  <label className="toggle-row" key={id}>
                    <b>{label}</b>
                    <input
                      type="checkbox"
                      checked={settings[id]}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, [id]: e.target.checked }))
                      }
                    />
                  </label>
                ))}
                <button className="button primary" disabled={saving}>
                  保存设置
                </button>
              </form>
            </Panel>
            <WorkflowSettings state={state} call={call} />
            <button className="button" onClick={() => setPage("briefing")}>
              早晚报与推送
            </button>
          </div>
          <div hidden={tab !== "appearance"}>
            <Panel className="panel">
              <h2>界面</h2>
              <div className="settings-actions">
                <button
                  className="button primary"
                  onClick={() => setPage("workbench")}
                >
                  主题、背景与小组件
                </button>
                <button className="button" onClick={openSidebarManager}>
                  整理侧栏
                </button>
              </div>
            </Panel>
          </div>
          <div hidden={tab !== "account"}>
            <Panel className="panel">
              <h2>账号与跨设备同步</h2>
              <p>{state.account?.user?.email}</p>
              <div className="settings-actions">
                <button
                  className="button primary"
                  onClick={() => setPage("account")}
                >
                  管理账号与同步
                </button>
                <button
                  className="button"
                  onClick={async () => {
                    await call("school.logout");
                    toast("学校登录已退出");
                  }}
                >
                  退出学校登录
                </button>
              </div>
            </Panel>
          </div>
          <div hidden={tab !== "data"}>
            <Panel className="panel">
              <h2>备份与恢复</h2>
              <div className="settings-actions">
                <button
                  className="button"
                  onClick={() => call("export.backup")}
                >
                  <Download size={16} />
                  导出完整备份
                </button>
                <button
                  className="button"
                  onClick={() => call("import.backup")}
                >
                  <Upload size={16} />
                  从备份恢复
                </button>
                <button className="button" onClick={() => call("data.folder")}>
                  <FolderOpen size={16} />
                  打开数据文件夹
                </button>
              </div>
              <details>
                <summary>备份范围</summary>
                <p>备份本机工作空间，不包含校园登录凭据。恢复前自动备份。</p>
              </details>
            </Panel>
          </div>
          <div hidden={tab !== "help"}>
            <Panel className="panel">
              <h2>帮助与手册</h2>
              <div className="settings-actions">
                <button
                  className="button primary"
                  onClick={() => openManual("user")}
                >
                  使用说明
                </button>
                <button
                  className="button"
                  onClick={() => openManual("developer")}
                >
                  开发者手册 · Zeus
                </button>
                <button className="button" onClick={startTour}>
                  重新播放新手教程
                </button>
              </div>
            </Panel>
          </div>
          <div hidden={tab !== "updates"}>
            <Panel className="panel">
              <UpdateCenter
                updates={state.updates}
                call={call}
                toast={toast}
                userId={state.account?.user?.id}
              />
            </Panel>
          </div>
          <div hidden={tab !== "about"}>
            <Panel className="panel">
              <h2>医栈通</h2>
              <p>{APP_LABEL}</p>
              <p>由 Medtrix 团队制作</p>
            </Panel>
            <Panel className="panel" title="联系我们">
              <h2>联系我们</h2>
              <p>
                微信：<span className="contact-wechat">Veritas_Enterprise</span>
              </p>
              <button
                className="button"
                onClick={async () => {
                  try {
                    await call("contact.copy");
                    toast("微信号已复制");
                  } catch {
                    toast("请选中微信号复制");
                  }
                }}
              >
                复制微信号
              </button>
            </Panel>
            <Panel className="panel" title="鸣谢 MySHSMU">
              <h2>鸣谢 MySHSMU</h2>
              <LinkedText
                text="感谢 [tototwoto/MySHSMU](https://github.com/tototwoto/MySHSMU) 为校园功能提供参考。"
                call={call}
              />
              <p>
                教务接口与字段映射参考 ShsmuService.kt，课表解析与展示逻辑参考
                CurriculumUtils.kt、MainViewModel.kt；一次登录后的会话恢复参考
                PersistentCookieJar 与 MainViewModel。
              </p>
              <p>
                这些逻辑已改写为桌面端实现，登录信息使用本机加密保存。任务、专注、Poseidon、校园快讯与云账号等模块由本项目独立实现。
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
