import { lazy } from "react";
import { BellRing } from "lucide-react";
export default {
  id: "briefing",
  title: "快报与提醒",
  description: "课程与任务进入每日安排。",
  apiVersion: 1,
  version: "1.2.0",
  order: 5,
  routes: [
    {
      id: "briefing",
      title: "快报与提醒",
      icon: BellRing,
      Component: lazy(() => import("./BriefingPage.jsx")),
      hiddenNav: true,
    },
  ],
};
