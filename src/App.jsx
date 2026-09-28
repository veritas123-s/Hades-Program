import React, { useEffect, useState } from "react";
import {
  Bell,
  Timer,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  X,
  Palette,
  Sparkles,
} from "lucide-react";
import { QUADRANTS, dayKey, elapsed, dayTotals } from "./domain.mjs";
import { TaskEditor, TaskCard, timeText } from "./components.jsx";
import { NAV, ModuleOutlet } from "./platform/modules.jsx";
import { useTheme } from "./themes/useTheme.jsx";
import { agenda } from "./agenda.mjs";
import AssistantPanel from "./modules/assistant/AssistantPanel.jsx";
import ListManager from "./shared/ListManager.jsx";
import AccountPage from "./modules/accounts/AccountPage.jsx";

export default function App() {
  const [state, setState] = useState(null),
    [page, setPage] = useState("today"),
    [editor, setEditor] = useState(null),
    [toast, setToast] = useState(""),
    [query, setQuery] = useState(""),
    [project, setProject] = useState("全部清单"),
    [filter, setFilter] = useState("active"),
    [focusTask, setFocusTask] = useState(""),
    [busy, setBusy] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [, setClock] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClock((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  useTheme(
    state?.locked
      ? {
          theme: "paper",
          appearance: {
            image: "none",
            opacity: 0,
            blur: 0,
            position: "center",
            fit: "cover",
          },
        }
      : state?.workspace,
  );
  const accept = (next) => {
    if (next?.schemaVersion)
      setState((old) =>
        !old || !next.revision || next.revision >= old.revision ? next : old,
      );
  };
  const call = async (action, payload) => {
    try {
      const result = await window.veritas.call(action, payload);
      accept(result);
      return result;
    } catch (error) {
      const msg = error.message.replace(
        /^Error invoking remote method '[^']+': Error: /,
        "",
      );
      setToast(msg);
      throw new Error(msg);
    }
  };
  useEffect(() => {
    const handler = (e) => e.preventDefault();
    window.addEventListener("unhandledrejection", handler);
    if (window.veritas) {
      window.veritas
        .call("state")
        .then(accept)
        .catch((e) => setToast(e.message));
      const stop = window.veritas.subscribe(accept);
      return () => {
        stop();
        window.removeEventListener("unhandledrejection", handler);
      };
    }
  }, []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    const handler = (e) => {
      if (!state?.account?.authenticated || state?.locked) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setEditor({});
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state?.account?.authenticated, state?.locked]);
  useEffect(() => {
    if (
      state &&
      project !== "全部清单" &&
      !state.lists?.some((l) => l.name === project && !l.deletedAt)
    )
      setProject("全部清单");
  }, [state?.lists, project]);
  if (!state)
    return (
      <div className="loading">
        <div className="brand-symbol">H</div>
        <h1>Hades V3.1.0</h1>
        <p>
          {window.veritas
            ? "正在打开你的工作空间…"
            : "请通过桌面程序打开此应用。"}
        </p>
        {toast && <p className="error">{toast}</p>}
      </div>
    );
  if (state.locked || !state.account?.authenticated)
    return (
      <main className="auth-shell">
        <div className="auth-brand">
          <div className="brand-symbol">H</div>
          <div>
            <h1>Hades</h1>
            <p>登录，打开你的个人空间</p>
          </div>
        </div>
        <AccountPage state={state} call={call} toast={setToast} locked />
        <div className="data-actions">
          <button className="button" onClick={() => call("help.open", { kind: "user" })}>使用说明</button>
          <button className="button" onClick={() => call("help.open", { kind: "developer" })}>开发者手册 · Zeus</button>
        </div>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </main>
    );
  const active = state.tasks.filter((t) => !t.deletedAt && !t.completedAt),
    projects = state.lists.filter((l) => !l.deletedAt).map((l) => l.name),
    totals = dayTotals(state.logs),
    today = dayKey(),
    todayMs = totals[today] || 0;
  const visible = state.tasks
    .filter(
      (t) =>
        (filter === "trash"
          ? t.deletedAt
          : !t.deletedAt &&
            (filter === "done"
              ? t.completedAt
              : filter === "today"
                ? !t.completedAt && t.due && t.due <= today
                : !t.completedAt)) &&
        (project === "全部清单" || t.project === project) &&
        `${t.title} ${t.notes} ${t.project}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.due || "9999").localeCompare(b.due || "9999") ||
        b.createdAt - a.createdAt,
    );
  const addTask = (quadrant = "plan") =>
    setEditor({
      quadrant,
      project: project === "全部清单" ? "收集箱" : project,
    });
  const focus = (t) => {
    setFocusTask(t.id);
    setPage("focus");
    if (state.timer.status !== "idle")
      setToast("当前已有计时，请先保存结束，再切换任务。");
  };
  const card = (t) => (
    <TaskCard
      key={t.id}
      task={t}
      call={call}
      onEdit={setEditor}
      onFocus={focus}
    />
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">H</div>
          <div>
            <b>
              Hades<span>3.1.0</span>
            </b>
            <small>任务 · 课程 · 专注</small>
          </div>
        </div>
        <button className="new-task" onClick={() => addTask()}>
          <Plus size={18} />
          新建任务<kbd>Ctrl N</kbd>
        </button>
        <div className="sidebar-scroll">
          <p className="nav-label">我的工作空间</p>
          <nav>
            {NAV.map(([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => setPage(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
                {id === "tasks" && <small>{active.length}</small>}
              </button>
            ))}
          </nav>
          <div className="sidebar-projects">
            <p className="nav-label">
              我的清单{" "}
              <button
                aria-label="新建清单"
                onClick={() => {
                  setListsOpen(true);
                }}
              >
                <Plus size={14} />
              </button>
            </p>
            {projects.map((p, i) => (
              <button
                key={p}
                className={page === "tasks" && project === p ? "selected" : ""}
                onClick={() => {
                  setProject(p);
                  setPage("tasks");
                  setFilter("active");
                }}
              >
                <i style={{ background: QUADRANTS[i % 4].color }} />
                {p}
                <small>{active.filter((t) => t.project === p).length}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="local-status">
            <i />
            {state.account?.sync?.phase === "synced"
              ? "已同步到云端"
              : state.account?.sync?.enabled
                ? "云同步已开启"
                : "保存在这台电脑"}
          </div>
          <button
            onClick={() => setPage("settings")}
            className={page === "settings" ? "active" : ""}
          >
            <Settings size={18} />
            设置与数据<span>V3.0</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            个人空间 <ChevronRight size={13} />
            <span>
              {page === "account"
                ? "账号与同步"
                : NAV.find((n) => n[0] === page)?.[1] || "设置与数据"}
            </span>
          </div>
          <div className="search">
            <Search size={16} />
            <input
              id="global-search"
              aria-label="搜索任务"
              placeholder="搜索任务与备注"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage("tasks");
                setFilter("active");
                setProject("全部清单");
              }}
            />
            {query && (
              <button
                className="search-clear"
                aria-label="清空搜索"
                onClick={() => setQuery("")}
              >
                <X size={15} />
              </button>
            )}
            <kbd>Ctrl K</kbd>
          </div>
          <button
            className="theme-shortcut"
            aria-label="更换主题"
            onClick={() => setPage("workbench")}
          >
            <Palette size={16} />
            <span>主题</span>
          </button>
          <button
            className="assistant-launch"
            aria-label="打开 AI 助手"
            onClick={() => setAssistantOpen(true)}
          >
            <Sparkles size={16} />
            <span>Poseidon 助手</span>
          </button>
          <button
            className="notification-bell"
            aria-label="打开通知中心"
            onClick={() => setPage("notifications")}
          >
            <Bell size={19} />
            <span>
              {
                agenda(state, state.learning).entries.filter(
                  (e) => !state.workflows?.read?.includes(e.id),
                ).length
              }
            </span>
          </button>
          <button
            className="avatar"
            aria-label="账号与同步"
            onClick={() => setPage("account")}
          >
            {state.account?.user?.nickname?.slice(0, 1) || "H"}
          </button>
        </header>
        <main>
          {state.lastNotice && (
            <div className="notice">
              <span>{state.lastNotice}</span>
              <button
                className="icon-button"
                aria-label="关闭通知"
                onClick={() => call("notice.dismiss")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <ModuleOutlet
            page={page}
            context={{
              state,
              call,
              page,
              setPage,
              filter,
              setFilter,
              project,
              setProject,
              projects,
              visible,
              card,
              addTask,
              openAssistant: () => setAssistantOpen(true),
              manageLists: () => setListsOpen(true),
              query,
              active,
              today,
              todayMs,
              selected: focusTask,
              setSelected: setFocusTask,
              toast: setToast,
              widgetActions: {
                navigate: setPage,
                addTask,
                editTask: setEditor,
                focusTask: focus,
                call,
              },
            }}
          />
          <footer className="page-footer">
            <span>Hades V3.1.0</span>
            <span>保存在这台电脑</span>
          </footer>
        </main>
        {state.timer.status !== "idle" && page !== "focus" && (
          <button className="floating-timer" onClick={() => setPage("focus")}>
            <span className={state.timer.status === "running" ? "pulse" : ""} />
            <Timer size={17} />
            {state.timer.taskTitle || "自由专注"}
            <b>
              {timeText(
                state.timer.targetMs
                  ? state.timer.targetMs - elapsed(state.timer)
                  : elapsed(state.timer),
              )}
            </b>
            <ArrowUpRight size={16} />
          </button>
        )}
      </div>
      <AssistantPanel
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        call={call}
        state={state}
        onBriefing={() => {
          setAssistantOpen(false);
          setPage("briefing");
        }}
        onManual={() => {
          setAssistantOpen(false);
          addTask();
        }}
      />
      {editor && (
        <TaskEditor
          task={editor}
          projects={projects}
          onClose={() => setEditor(null)}
          onSave={(form) => call("task.save", form)}
          onDelete={async () => {
            await call("task.delete", { id: editor.id });
            setEditor(null);
          }}
        />
      )}
      {listsOpen && (
        <ListManager
          state={state}
          call={call}
          onClose={() => setListsOpen(false)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
