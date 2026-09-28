import { lazy } from "react";
import { Settings } from "lucide-react";
export default {
  id: "settings",
  title: "设置与数据",
  description: "节奏、提醒和数据备份。",
  apiVersion: 1,
  version: "1.2.0",
  order: 7,
  routes: [
    {
      id: "settings",
      title: "设置与数据",
      icon: Settings,
      Component: lazy(() => import("./SettingsPage.jsx")),
      hiddenNav: true,
    },
  ],
};
