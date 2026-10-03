import { lazy } from "react";
import { Mail } from "lucide-react";
export default {
  id: "sjtu-mail",
  title: "交大邮箱",
  apiVersion: 1,
  version: "1.0.0",
  order: 7,
  routes: [
    {
      id: "sjtu-mail",
      title: "交大邮箱",
      icon: Mail,
      Component: lazy(() => import("./MailPage.jsx")),
    },
  ],
};
