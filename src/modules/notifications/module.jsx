import { lazy } from "react";
import { Bell, CalendarDays } from "lucide-react";
export default {
  id: "notifications",
  title: "日程与通知",
  description: "课程、任务和学习通动态",
  apiVersion: 1,
  version: "3.0.0",
  order: 1,
  routes: [
    {
      id: "learning",
      title: "超星学习通",
      icon: Bell,
      Component: lazy(() => import("./LearningPage.jsx")),
    },
    {
      id: "calendar",
      title: "日程日历",
      icon: CalendarDays,
      Component: lazy(() => import("./CalendarPage.jsx")),
    },
    {
      id: "notifications",
      title: "日程与通知",
      icon: Bell,
      Component: lazy(() => import("./NotificationsPage.jsx")),
    },
  ],
  widgets: [],
};
