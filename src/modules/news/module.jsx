import { lazy } from "react";
import { Newspaper } from "lucide-react";
export default {
  id: "campus-news",
  title: "校园快讯",
  description: "公开消息采集与来源覆盖",
  apiVersion: 1,
  version: "4.0.0",
  order: 6,
  routes: [
    {
      id: "campus-news",
      title: "校园快讯",
      icon: Newspaper,
      Component: lazy(() => import("./NewsPage.jsx")),
    },
  ],
};
