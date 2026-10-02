import { lazy } from "react";
import { Sparkles } from "lucide-react";
export default {
  id: "assistant",
  title: "Poseidon 助手",
  description: "学校模型、任务草稿与一站式安排。",
  apiVersion: 1,
  version: "2.0.0",
  order: 2,
  routes: [
    {
      id: "assistant",
      hiddenNav: true,
      title: "Poseidon 助手",
      icon: Sparkles,
      Component: lazy(() => import("./AssistantPage.jsx")),
    },
  ],
};
