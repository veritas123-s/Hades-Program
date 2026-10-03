import React, { useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Trash2,
  History,
  Pencil,
  Check,
  Link2,
  CalendarDays,
  Sparkles,
} from "lucide-react";
import { Modal, Empty, duration } from "../../components.jsx";
import {
  PROJECT_STAGES,
  NOTE_KINDS,
  NOTE_TEMPLATES,
  initialHub,
  projectSummary,
  searchHub,
} from "../../domain/workhub.mjs";
import { dayKey } from "../../domain.mjs";
import "./research.css";

const labels = {
  projects: "项目",
  notes: "知识记录",
  tasks: "任务",
  events: "日程",
};
const routes = {
  projects: "research-projects",
  notes: "knowledge",
};
const stamp = (n) => new Date(n).toLocaleString("zh-CN", { hour12: false });
function Field({ label, children }) {
  return (
    <label className="hub-field">
      <span>{label}</span>
      {React.cloneElement(children, { "aria-label": label })}
    </label>
  );
}
function Button({ children, onClick, primary = false, ...rest }) {
  return (
    <button
      type="button"
      className={`button small ${primary ? "primary" : ""}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export default function ResearchPage({
  state,
  call,
  page,
  setPage,
  widgetActions,
  openAssistant,
  query: globalQuery,
  setQuery: setGlobalQuery,
  researchSelection: selection,
  setResearchSelection: setSelection,
}) {
  const hub = state.workhub ?? initialHub();
  const [editor, setEditor] = useState(null),
    [localQuery, setLocalQuery] = useState(""),
    [view, setView] = useState("active"),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const query = globalQuery || localQuery;
  const collection =
    page === "research-projects"
      ? "projects"
      : page === "knowledge"
        ? "notes"
        : null;
  const shown = (hub[collection] ?? [])
    .filter((x) => (view === "trash" ? x.deletedAt : !x.deletedAt))
    .filter(
      (x) =>
        !query ||
        `${x.title} ${x.body ?? ""} ${x.objective ?? ""} ${x.tags?.join(" ") ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .toSorted((a, b) => b.updatedAt - a.updatedAt);
  const selected = shown.find((x) => x.id === selection) ?? shown[0];
  const projects = hub.projects.filter((p) => !p.deletedAt);
  const act = async (action, payload) => {
    setError("");
    setWorking(true);
    try {
      return await call(action, payload);
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setWorking(false);
    }
  };
  const open = (kind, id) => {
    setSelection(id);
    setView("active");
    setLocalQuery("");
    setGlobalQuery?.("");
    setPage(routes[kind]);
  };
  const edit = (kind, item = {}) => setEditor({ kind, item });
  const saveItem = async (form) => {
    await act("hub.save", { ...form, collection: editor.kind });
    setEditor(null);
  };
  const projectName = (id) =>
    hub.projects.find((p) => p.id === id)?.title || "未关联项目";
  const today = dayKey();
  const upcoming = state.events
    .filter((e) => !e.deletedAt && e.end.slice(0, 10) >= today)
    .toSorted((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);
  return (
    <div className="research-shell">
      <div className="page-heading">
        <div>
          <h1>
            {collection
              ? { projects: "项目管理", notes: "知识库" }[collection]
              : "工作台"}
          </h1>
          <span className="hub-muted">
            当前账号 · 本机保存 · 完整备份可导出
          </span>
        </div>
        <div className="hub-actions">
          <Button onClick={openAssistant}>
            <Sparkles size={15} />
            Poseidon
          </Button>
          <Button primary onClick={() => edit(collection ?? "projects")}>
            <Plus size={15} />
            新建{labels[collection ?? "projects"]}
          </Button>
        </div>
      </div>
      {error && (
        <div className="hub-error" role="alert">
          {error}
        </div>
      )}
      <div className="hub-toolbar">
        <div className="hub-search">
          <Search size={16} />
          <input
            aria-label="检索工作台"
            placeholder={
              collection ? "搜索名称、内容或标签" : "搜索项目、知识、任务与日程"
            }
            value={query}
            maxLength={200}
            onChange={(e) => {
              setGlobalQuery?.("");
              setLocalQuery(e.target.value);
            }}
          />
        </div>
        {collection ? (
          <div className="tabs">
            {[
              ["active", "全部记录"],
              ["trash", "回收站"],
            ].map(([id, text]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => setView(id)}
              >
                {text}
              </button>
            ))}
          </div>
        ) : (
          <Button
            onClick={() => setView(view === "audit" ? "active" : "audit")}
          >
            <History size={15} />
            {view === "audit" ? "返回概览" : "操作记录"}
          </Button>
        )}
      </div>
      {!collection &&
        (query ? (
          <section className="hub-card hub-results">
            <h2>搜索结果</h2>
            {searchHub(state, query).length ? (
              searchHub(state, query).map((r) => (
                <button
                  className="hub-result"
                  key={`${r.type}:${r.id}`}
                  onClick={() => {
                    if (routes[r.type]) open(r.type, r.id);
                    else if (r.type === "tasks")
                      widgetActions.editTask(
                        state.tasks.find((t) => t.id === r.id),
                      );
                    else
                      setEditor({
                        kind: "eventView",
                        item: state.events.find((e) => e.id === r.id),
                      });
                  }}
                >
                  <small>{labels[r.type]}</small>
                  <strong>{r.title}</strong>
                  <span>{r.text}</span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <Empty title="没有匹配结果">换一个关键词试试。</Empty>
            )}
          </section>
        ) : view === "audit" ? (
          <section className="hub-card hub-scroll">
            <h2>操作记录</h2>
            <p className="hub-muted">
              最近 3000 次工作台操作；本机记录，可随完整备份保存。
            </p>
            {[...hub.audit].reverse().map((a) => (
              <div className="hub-audit" key={a.id}>
                <time>{stamp(a.at)}</time>
                <span>{a.action}</span>
                <strong>{a.title}</strong>
              </div>
            ))}
            {!hub.audit.length && <Empty title="还没有操作记录" />}
          </section>
        ) : (
          <>
            <div className="hub-metrics">
              {[
                [
                  "进行中项目",
                  projects.filter((p) => p.stage === "active").length,
                  "research-projects",
                ],
                [
                  "项目待办",
                  new Set(
                    projects.flatMap((p) =>
                      projectSummary(state, p)
                        .tasks.filter((t) => !t.completedAt)
                        .map((t) => t.id),
                    ),
                  ).size,
                  "research-projects",
                ],
                [
                  "知识记录",
                  hub.notes.filter((n) => !n.deletedAt).length,
                  "knowledge",
                ],
                [
                  "今日日程",
                  state.events.filter(
                    (e) =>
                      !e.deletedAt &&
                      e.start.slice(0, 10) <= today &&
                      e.end.slice(0, 10) >= today,
                  ).length,
                  "calendar",
                ],
              ].map(([label, value, route]) => (
                <button
                  key={label}
                  className="hub-card"
                  onClick={() => setPage(route)}
                >
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <ArrowUpRight size={15} />
                </button>
              ))}
            </div>
            <div className="hub-overview-grid">
              <section className="hub-card hub-scroll">
                <header>
                  <h2>我的项目</h2>
                  <Button onClick={() => setPage("research-projects")}>
                    全部项目
                  </Button>
                </header>
                {projects.length ? (
                  projects.map((p) => {
                    const s = projectSummary(state, p);
                    return (
                      <button
                        key={p.id}
                        className="hub-project-row"
                        onClick={() => open("projects", p.id)}
                      >
                        <div>
                          <strong>{p.title}</strong>
                          <span className="hub-badge">
                            {PROJECT_STAGES[p.stage]}
                          </span>
                        </div>
                        <progress value={s.done} max={s.total || 1} />
                        <small>
                          {s.done}/{s.total} 个任务 ·{" "}
                          {s.overdue ? `${s.overdue} 个逾期 · ` : ""}
                          {p.due || "未设期限"}
                        </small>
                      </button>
                    );
                  })
                ) : (
                  <Empty
                    icon={BriefcaseBusiness}
                    title="从一个明确目标开始"
                    action={
                      <Button primary onClick={() => edit("projects")}>
                        创建第一个项目
                      </Button>
                    }
                  >
                    把学习、研究或课程成果拆成可推进的项目。
                  </Empty>
                )}
              </section>
              <div className="hub-overview-side">
                <section className="hub-card hub-scroll">
                  <header>
                    <h2>最近知识</h2>
                    <BookOpen size={17} />
                  </header>
                  {hub.notes
                    .filter((n) => !n.deletedAt)
                    .toSorted((a, b) => b.updatedAt - a.updatedAt)
                    .slice(0, 8)
                    .map((n) => (
                      <button
                        className="hub-simple-row"
                        key={n.id}
                        onClick={() => open("notes", n.id)}
                      >
                        <strong>{n.title}</strong>
                        <small>
                          {NOTE_KINDS[n.kind]} · {projectName(n.projectId)}
                        </small>
                      </button>
                    ))}
                  {!hub.notes.some((n) => !n.deletedAt) && (
                    <p className="hub-muted">暂无知识记录</p>
                  )}
                </section>
                <section className="hub-card hub-scroll">
                  <header>
                    <h2>近期日程</h2>
                    <CalendarDays size={17} />
                  </header>
                  {upcoming.map((e) => (
                    <button
                      className="hub-simple-row"
                      key={e.id}
                      onClick={() => setEditor({ kind: "eventView", item: e })}
                    >
                      <strong>{e.title}</strong>
                      <small>
                        {e.start.replace("T", " ")} · {e.location || "未设地点"}
                      </small>
                    </button>
                  ))}
                  {!upcoming.length && (
                    <p className="hub-muted">暂无近期日程</p>
                  )}
                </section>
              </div>
            </div>
          </>
        ))}
      {collection && (
        <div className="hub-split">
          <aside
            className="hub-card hub-records"
            aria-label={`${labels[collection]}列表`}
          >
            {shown.map((item) => (
              <button
                key={item.id}
                className={`hub-record ${selected?.id === item.id ? "selected" : ""}`}
                onClick={() => setSelection(item.id)}
              >
                <strong>{item.title}</strong>
                <small>
                  {collection === "projects"
                    ? PROJECT_STAGES[item.stage]
                    : NOTE_KINDS[item.kind]}
                </small>
                <span>
                  {collection === "projects"
                    ? item.due || "未设期限"
                    : projectName(item.projectId)}
                </span>
              </button>
            ))}
            {!shown.length && (
              <Empty
                title={
                  view === "trash"
                    ? "回收站为空"
                    : query
                      ? "没有匹配记录"
                      : "还没有记录"
                }
              />
            )}
          </aside>
          <section className="hub-card hub-detail">
            {selected ? (
              <>
                <header>
                  <div>
                    <h2>{selected.title}</h2>
                    <span className="hub-muted">
                      更新于 {stamp(selected.updatedAt)}
                    </span>
                  </div>
                  <div className="hub-actions">
                    {selected.deletedAt ? (
                      <Button
                        disabled={working}
                        onClick={() =>
                          act("hub.restore", {
                            collection,
                            id: selected.id,
                            revision: selected.revision,
                          })
                        }
                      >
                        恢复
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => edit(collection, selected)}>
                          <Pencil size={14} />
                          编辑
                        </Button>
                        <Button
                          disabled={working}
                          aria-label="移入回收站"
                          onClick={() =>
                            act("hub.delete", {
                              collection,
                              id: selected.id,
                              revision: selected.revision,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </header>
                {collection === "projects" && (
                  <ProjectDetail
                    {...{
                      state,
                      selected,
                      hub,
                      open,
                      edit,
                      act,
                      working,
                      widgetActions,
                    }}
                  />
                )}
                {collection === "notes" && (
                  <>
                    <div className="hub-meta">
                      <span className="hub-badge">
                        {NOTE_KINDS[selected.kind]}
                      </span>
                      <span>{projectName(selected.projectId)}</span>
                      <span>
                        {selected.aiVisible
                          ? "允许 Poseidon 检索"
                          : "正文仅本机使用"}
                      </span>
                    </div>
                    <div className="hub-tags">
                      {selected.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </div>
                    {selected.source && (
                      <p className="hub-source">来源：{selected.source}</p>
                    )}
                    <article className="hub-document">
                      {selected.body || "尚未填写正文"}
                    </article>
                    {!!selected.history.length && (
                      <details>
                        <summary>修订历史（保留最近 20 版）</summary>
                        {[...selected.history.entries()]
                          .reverse()
                          .map(([i, v]) => (
                            <div className="hub-revision" key={i}>
                              <div>
                                <strong>{v.title}</strong>
                                <small>{stamp(v.savedAt)}</small>
                                <pre>{v.body.slice(0, 300)}</pre>
                              </div>
                              <Button
                                disabled={working || !!selected.deletedAt}
                                onClick={() =>
                                  act("hub.noteRestore", {
                                    id: selected.id,
                                    revision: selected.revision,
                                    index: i,
                                  })
                                }
                              >
                                恢复此版
                              </Button>
                            </div>
                          ))}
                      </details>
                    )}
                  </>
                )}
              </>
            ) : (
              <Empty
                icon={collection === "notes" ? BookOpen : BriefcaseBusiness}
                title="选择或创建一条记录"
                action={
                  view !== "trash" && (
                    <Button primary onClick={() => edit(collection)}>
                      新建{labels[collection]}
                    </Button>
                  )
                }
              />
            )}
          </section>
        </div>
      )}
      {editor && ["projects", "notes"].includes(editor.kind) && (
        <RecordEditor
          key={`${editor.kind}:${editor.item.id ?? "new"}`}
          {...editor}
          projects={projects}
          onSave={saveItem}
          onClose={() => setEditor(null)}
        />
      )}
      {editor && ["task", "event", "link"].includes(editor.kind) && (
        <ActionEditor
          key={editor.kind}
          editor={editor}
          state={state}
          onClose={() => setEditor(null)}
          onSave={async (action, payload) => {
            await act(action, payload);
            setEditor(null);
          }}
        />
      )}
      {editor?.kind === "eventView" && (
        <Modal title={editor.item.title} onClose={() => setEditor(null)}>
          <p>
            {editor.item.start.replace("T", " ")} 至{" "}
            {editor.item.end.replace("T", " ")}
          </p>
          <p>{editor.item.location}</p>
          <p className="hub-document">{editor.item.notes}</p>
          <Button
            onClick={() => {
              setEditor(null);
              setPage("calendar");
            }}
          >
            打开日历
          </Button>
        </Modal>
      )}
    </div>
  );
}

function ProjectDetail({
  state,
  selected: p,
  hub,
  open,
  edit,
  act,
  working,
  widgetActions,
}) {
  const s = projectSummary(state, p);
  return (
    <>
      <div className="hub-meta">
        <span className="hub-badge">{PROJECT_STAGES[p.stage]}</span>
        <span>期限：{p.due || "未设定"}</span>
        <span>投入 {duration(s.focusMs)}</span>
      </div>
      <p className="hub-document">{p.objective || "尚未填写项目目标"}</p>
      <div className="hub-progress">
        <progress max={s.total || 1} value={s.done} />
        <span>
          {s.progress}% · {s.done}/{s.total} 完成
          {s.overdue > 0 ? ` · ${s.overdue} 个逾期` : ""}
        </span>
      </div>
      {!!p.milestones.length && (
        <section>
          <h3>里程碑</h3>
          {p.milestones.map((m, i) => (
            <label className="hub-milestone" key={i}>
              <input
                type="checkbox"
                checked={m.done}
                disabled={working || !!p.deletedAt}
                onChange={() =>
                  act("hub.save", {
                    ...p,
                    collection: "projects",
                    milestones: p.milestones.map((v, j) =>
                      j === i ? { ...v, done: !v.done } : v,
                    ),
                  })
                }
              />
              <span>{m.title}</span>
              <small>{m.due}</small>
            </label>
          ))}
        </section>
      )}
      <section>
        <header>
          <h3>关联任务</h3>
          {!p.deletedAt && (
            <div className="hub-actions">
              <Button onClick={() => edit("link", { ...p, target: "tasks" })}>
                <Link2 size={14} />
                关联已有
              </Button>
              <Button primary onClick={() => edit("task", p)}>
                <Plus size={14} />
                添加任务
              </Button>
            </div>
          )}
        </header>
        {s.tasks.map((t) => (
          <div className="hub-linked-row" key={t.id}>
            <button
              className="icon-button"
              disabled={working}
              aria-label={t.completedAt ? `重开${t.title}` : `完成${t.title}`}
              onClick={() => act("task.complete", { id: t.id })}
            >
              {t.completedAt ? (
                <Check size={17} />
              ) : (
                <span className="hub-checkbox" />
              )}
            </button>
            <button
              className="hub-linked-title"
              onClick={() => widgetActions.editTask(t)}
            >
              <strong className={t.completedAt ? "hub-done" : ""}>
                {t.title}
              </strong>
              <small>{t.due || "未设期限"}</small>
            </button>
            <Button onClick={() => widgetActions.focusTask(t)}>专注</Button>
            <Button
              disabled={working || !!p.deletedAt}
              aria-label={`解除关联${t.title}`}
              onClick={() =>
                act("hub.link", {
                  id: p.id,
                  revision: p.revision,
                  target: "tasks",
                  targetId: t.id,
                  remove: true,
                })
              }
            >
              解除
            </Button>
          </div>
        ))}
        {!s.total && (
          <p className="hub-muted">
            添加任务后，完成进度与专注投入会自动汇总。
          </p>
        )}
      </section>
      <section>
        <header>
          <h3>项目日程</h3>
          {!p.deletedAt && (
            <div className="hub-actions">
              <Button onClick={() => edit("link", { ...p, target: "events" })}>
                关联已有
              </Button>
              <Button onClick={() => edit("event", p)}>添加日程</Button>
            </div>
          )}
        </header>
        {s.events.map((e) => (
          <div key={e.id} className="hub-linked-row">
            <button
              className="hub-linked-title"
              onClick={() => edit("eventView", e)}
            >
              <strong>{e.title}</strong>
              <small>{e.start.replace("T", " ")}</small>
            </button>
            <Button
              disabled={working || !!p.deletedAt}
              onClick={() =>
                act("hub.link", {
                  id: p.id,
                  revision: p.revision,
                  target: "events",
                  targetId: e.id,
                  remove: true,
                })
              }
            >
              解除
            </Button>
          </div>
        ))}
        {!s.events.length && <p className="hub-muted">暂无关联日程</p>}
      </section>
      <section>
        <header>
          <h3>项目知识</h3>
          {!p.deletedAt && (
            <Button onClick={() => edit("notes", { projectId: p.id })}>
              写记录
            </Button>
          )}
        </header>
        {hub.notes
          .filter((n) => n.projectId === p.id && !n.deletedAt)
          .map((n) => (
            <button
              key={n.id}
              className="hub-simple-row"
              onClick={() => open("notes", n.id)}
            >
              <strong>{n.title}</strong>
              <small>{NOTE_KINDS[n.kind]}</small>
            </button>
          ))}
      </section>
      <p className="hub-muted">
        项目移入回收站会保留任务、日程和原始专注记录；已删除或云端缺失的关联条目不计入进度。
      </p>
    </>
  );
}

function RecordEditor({ kind, item, projects, onSave, onClose }) {
  const [form, setForm] = useState({
    title: "",
    objective: "",
    stage: "planning",
    due: "",
    milestones: [],
    kind: "note",
    body: "",
    projectId: "",
    tags: [],
    source: "",
    aiVisible: false,
    ...item,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const input = (key, type = "text", maxLength = 200, required = false) => (
    <input
      type={type}
      required={required}
      maxLength={maxLength}
      value={form[key]}
      onChange={(e) => field(key, e.target.value)}
    />
  );
  return (
    <Modal
      title={`${item.id ? "编辑" : "新建"}${labels[kind]}`}
      onClose={onClose}
      wide
    >
      <form
        className="hub-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave({
              ...form,
              tags: [
                ...new Set(form.tags.map((t) => t.trim()).filter(Boolean)),
              ],
            });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="名称">
          {input("title", "text", kind === "projects" ? 120 : 160, true)}
        </Field>
        {kind === "projects" ? (
          <>
            <div className="hub-form-grid">
              <Field label="阶段">
                <select
                  value={form.stage}
                  onChange={(e) => field("stage", e.target.value)}
                >
                  {Object.entries(PROJECT_STAGES).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="截止日期">{input("due", "date")}</Field>
            </div>
            <Field label="项目目标">
              <textarea
                rows={4}
                maxLength={10000}
                value={form.objective}
                onChange={(e) => field("objective", e.target.value)}
              />
            </Field>
            <fieldset>
              <legend>里程碑</legend>
              {form.milestones.map((m, i) => (
                <div className="hub-milestone-edit" key={i}>
                  <input
                    required
                    aria-label={`里程碑${i + 1}`}
                    maxLength={200}
                    value={m.title}
                    onChange={(e) =>
                      field(
                        "milestones",
                        form.milestones.map((v, j) =>
                          j === i ? { ...v, title: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <input
                    type="date"
                    aria-label={`里程碑日期${i + 1}`}
                    value={m.due}
                    onChange={(e) =>
                      field(
                        "milestones",
                        form.milestones.map((v, j) =>
                          j === i ? { ...v, due: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Button
                    aria-label={`移除里程碑${i + 1}`}
                    onClick={() =>
                      field(
                        "milestones",
                        form.milestones.filter((_, j) => i !== j),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                disabled={form.milestones.length >= 60}
                onClick={() =>
                  field("milestones", [
                    ...form.milestones,
                    { title: "", due: "", done: false },
                  ])
                }
              >
                添加里程碑
              </Button>
            </fieldset>
          </>
        ) : (
          <>
            <Field label="关联项目">
              <select
                value={form.projectId}
                onChange={(e) => field("projectId", e.target.value)}
              >
                <option value="">未关联项目</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <>
              <div className="hub-form-grid">
                <Field label="类型">
                  <select
                    value={form.kind}
                    onChange={(e) => field("kind", e.target.value)}
                  >
                    {Object.entries(NOTE_KINDS).map(([id, title]) => (
                      <option value={id} key={id}>
                        {title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="标签（英文逗号分隔）">
                  <input
                    maxLength={370}
                    value={form.tags.join(",")}
                    onChange={(e) =>
                      field(
                        "tags",
                        e.target.value ? e.target.value.split(",") : [],
                      )
                    }
                  />
                </Field>
              </div>
              <Field label="来源 / DOI / 原始数据位置">
                {input("source", "text", 2000)}
              </Field>
              <Button
                disabled={!!form.body}
                onClick={() => field("body", NOTE_TEMPLATES[form.kind])}
              >
                插入{NOTE_KINDS[form.kind]}模板
              </Button>
            </>
            <Field label="正文">
              <textarea
                rows={10}
                maxLength={60000}
                value={form.body}
                onChange={(e) => field("body", e.target.value)}
              />
            </Field>
            {kind === "notes" && (
              <label className="hub-check">
                <input
                  type="checkbox"
                  checked={form.aiVisible}
                  onChange={(e) => field("aiVisible", e.target.checked)}
                />
                允许 Poseidon 检索此篇正文（使用时发送给你配置的模型服务）
              </label>
            )}
          </>
        )}
        {error && (
          <p className="hub-error" role="alert">
            {error}
          </p>
        )}
        <footer className="hub-actions">
          <Button onClick={onClose} disabled={busy}>
            取消
          </Button>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? "保存中…" : "保存"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function ActionEditor({ editor, state, onSave, onClose }) {
  const { kind, item } = editor;
  const [form, setForm] = useState({
    title: "",
    due: "",
    start: "",
    end: "",
    location: "",
    targetId: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = (key, label, type = "text", required = false) => (
    <Field label={label}>
      <input
        required={required}
        type={type}
        maxLength={200}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );
  const names = {
    task: "添加项目任务",
    event: "添加项目日程",
    link: "关联已有内容",
  };
  return (
    <Modal title={names[kind]} onClose={onClose}>
      <form
        className="hub-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const base = { id: item.id, revision: item.revision };
          try {
            if (kind === "task")
              await onSave("hub.createTask", {
                ...base,
                task: { title: form.title, due: form.due },
              });
            if (kind === "event")
              await onSave("hub.createEvent", {
                ...base,
                event: {
                  title: form.title,
                  start: form.start,
                  end: form.end,
                  location: form.location,
                },
              });
            if (kind === "link")
              await onSave("hub.link", {
                ...base,
                target: item.target,
                targetId: form.targetId,
              });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {["task", "event"].includes(kind) &&
          input("title", "名称", "text", true)}
        {kind === "task" && input("due", "截止日期", "date")}
        {kind === "event" && (
          <>
            {input("start", "开始时间", "datetime-local", true)}
            {input("end", "结束时间", "datetime-local", true)}
            {input("location", "地点")}
          </>
        )}
        {kind === "link" && (
          <Field label="选择记录">
            <select
              required
              value={form.targetId}
              onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            >
              <option value="">请选择</option>
              {state[item.target]
                .filter(
                  (x) =>
                    !x.deletedAt &&
                    !(
                      item[item.target === "tasks" ? "taskIds" : "eventIds"] ??
                      []
                    ).includes(x.id),
                )
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {error && (
          <p className="hub-error" role="alert">
            {error}
          </p>
        )}
        <footer className="hub-actions">
          <Button disabled={busy} onClick={onClose}>
            取消
          </Button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "保存中…" : "确认"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
