import { lazy } from "react";
import { Timer } from "lucide-react";
export default {
  id: "focus",
  title: "专注空间",
  description: "番茄与连续工作计时。",
  apiVersion: 1,
  version: "1.2.0",
  order: 2,
  routes: [
    {
      id: "focus",
      title: "专注空间",
      icon: Timer,
      Component: lazy(() => import("./FocusPage.jsx")),
      hiddenNav: false,
    },
  ],
};
