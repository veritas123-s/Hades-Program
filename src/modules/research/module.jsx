import { lazy } from "react";
import { BriefcaseBusiness, BookOpen, LayoutDashboard } from "lucide-react";
const Component = lazy(() => import("./ResearchPage.jsx"));
export default {
  id: "research",
  title: "学习与科研",
  apiVersion: 1,
  version: "1.0.0",
  order: 0.5,
  routes: [
    {
      id: "research-hub",
      title: "工作台",
      icon: LayoutDashboard,
      Component,
    },
    {
      id: "research-projects",
      title: "项目管理",
      icon: BriefcaseBusiness,
      Component,
    },
    { id: "knowledge", title: "知识库", icon: BookOpen, Component },
  ],
};
