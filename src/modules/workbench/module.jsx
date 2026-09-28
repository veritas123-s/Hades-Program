import { lazy } from "react";
import { Palette } from "lucide-react";
export default {
  id: "workbench",
  title: "主题与小组件",
  description: "选择外观，组合首页。",
  apiVersion: 1,
  version: "1.2.0",
  order: 6,
  routes: [
    {
      id: "workbench",
      title: "主题与小组件",
      icon: Palette,
      Component: lazy(() => import("./WorkbenchPage.jsx")),
      hiddenNav: false,
    },
  ],
};
