import { lazy } from "react";
import { BarChart3 } from "lucide-react";
export default {
  id: "insights",
  title: "时间记录",
  description: "查看和整理自己的投入。",
  apiVersion: 1,
  version: "1.2.0",
  order: 3,
  routes: [
    {
      id: "stats",
      title: "时间记录",
      icon: BarChart3,
      Component: lazy(() => import("./StatsPage.jsx")),
      hiddenNav: false,
    },
  ],
};
