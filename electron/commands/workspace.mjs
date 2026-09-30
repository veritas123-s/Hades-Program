import {
  initialWorkspace,
  updateWorkspace,
  saveWidgetData,
} from "../../src/platform/model.mjs";
export default async function execute(action, p, { store }) {
  store.change((state) => {
    if (action === "workspace.configure")
      state.workspace = updateWorkspace(state.workspace, p);
    else if (action === "widget.configure")
      state.workspace = saveWidgetData(state.workspace, p);
    else if (action === "widget.delete" || action === "widget.restore") {
      const row = state.workspace.widgetData[p.id];
      if (!p.id?.startsWith("custom-") || !row)
        throw Error("自定义小组件不存在");
      state.workspace = saveWidgetData(state.workspace, {
        id: p.id,
        version: row.version,
        data: {
          ...row.data,
          deletedAt: action === "widget.delete" ? Date.now() : null,
        },
      });
      state.workspace = updateWorkspace(state.workspace, {
        widgets: {
          hidden:
            action === "widget.delete"
              ? [...new Set([...state.workspace.widgets.hidden, p.id])]
              : state.workspace.widgets.hidden.filter((x) => x !== p.id),
        },
      });
    } else if (action === "workspace.reset")
      state.workspace = {
        ...initialWorkspace(),
        theme: state.workspace.theme,
        appearance: state.workspace.appearance,
        customThemes: state.workspace.customThemes,
        widgetData: state.workspace.widgetData,
      };
  });
}
