import React, { useState } from "react";
import { Download, Upload, FolderOpen } from "lucide-react";

export default function SettingsPage({ state, call, toast, setPage }) {
  const [settings, setSettings] = useState(state.settings),
    [saving, setSaving] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">偏好设置</p>
          <h1>适合你的，才是好节奏</h1>
          <p>调整专注节奏，照顾好自己的数据。</p>
        </div>
        <span className="version">Hades V3.1 / 3.1.0</span>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>帮助与手册</h2>
          <p>离线查看功能教程、账号同步说明及 Zeus 编写的开发维护手册。</p>
          <div className="data-actions">
            <button className="button" onClick={() => call("help.open", { kind: "user" })}>使用说明</button>
            <button className="button" onClick={() => call("help.open", { kind: "developer" })}>开发者手册 · Zeus</button>
          </div>
          <p className="hint">shsmuveritas.com 等待 ICP 备案完成，本版继续使用现有 HTTPS 账号服务。</p>
        </section>
        <section className="panel">
          <h2>专注与提醒</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await call("settings", settings);
                toast("设置已保存，新的时长将在下一段计时生效。");
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
              ["notifications", "系统通知", "番茄结束和任务到时提醒"],
              [
                "sound",
                "通知声音",
                "由 Windows 系统通知控制；勿扰模式可能静音",
              ],
              [
                "closeToTray",
                "关闭窗口时收起到托盘",
                "继续计时和提醒；托盘菜单可完全退出",
              ],
            ].map(([id, label, desc]) => (
              <label className="toggle-row" key={id}>
                <div>
                  <b>{label}</b>
                  <small>{desc}</small>
                </div>
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
        </section>
        <div>
          <section className="panel"><h2>账号与跨设备同步</h2><p>{state.account?.user?.email||'登录后，把任务、日程和专注记录带到其他电脑。'}</p><button className="button primary" onClick={()=>setPage('account')}>管理账号与同步</button></section>
          <section className="panel">
            <h2>数据由你掌控</h2>
            <p className="hint">
              任务、工作记录和校园缓存保存在这台电脑。完整备份可在其他安装中恢复，不包含学校登录信息。
            </p>
            <div className="data-actions">
              <button className="button" onClick={() => call("export.backup")}>
                <Download size={16} />
                导出完整备份
              </button>
              <button className="button" onClick={() => call("import.backup")}>
                <Upload size={16} />
                从备份恢复
              </button>
              <button className="button" onClick={() => call("data.folder")}>
                <FolderOpen size={16} />
                打开数据文件夹
              </button>
            </div>
          </section>
          <section className="panel about">
            <p className="eyebrow">关于 Hades</p>
            <h3>一个持续成长的个人工作台</h3>
            <p>V3.0：云端账号、通用日历交换，以及更清晰的桌面界面。</p>
            <p>
              七款主题、可组合小组件、Poseidon 助手与校园连接，按你的方式使用。
            </p>
            <small>
              校园接口参考 tototwoto/MySHSMU。
              <br />
              云同步需登录并开启；校园和模型服务使用各自的授权。
            </small>
            <button
              className="text-button"
              onClick={async () => {
                await call("school.logout");
                toast("学校登录会话已清除，缓存仍保留在本机。");
              }}
            >
              退出学校登录
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
