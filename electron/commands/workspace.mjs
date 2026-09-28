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
    else if (action === "workspace.reset")
      state.workspace = {
        ...initialWorkspace(),
        theme: state.workspace.theme,
        appearance: state.workspace.appearance,
        customThemes: state.workspace.customThemes,
        widgetData: state.workspace.widgetData,
      };
  });
}
