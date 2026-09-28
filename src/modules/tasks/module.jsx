import { lazy } from "react";
import { CheckSquare2, Columns2 } from "lucide-react";
export default {
  id: "tasks",
  title: "任务与四象限",
  description: "计划、优先级与完成记录。",
  apiVersion: 1,
  version: "1.2.0",
  order: 1,
  routes: [
    {
      id: "tasks",
      title: "任务清单",
      icon: CheckSquare2,
      Component: lazy(() => import("./TasksPage.jsx")),
      hiddenNav: false,
    },
    {
      id: "matrix",
      title: "四象限",
      icon: Columns2,
      Component: lazy(() => import("./TasksPage.jsx")),
      hiddenNav: false,
    },
  ],
};
