import AccountPage from "./AccountPage.jsx";
import { UserRound } from "lucide-react";
export default {
  id: "account",
  title: "账号与同步",
  description: "云端账号和跨设备数据",
  apiVersion: 1,
  version: "3.0.5",
  order: 8,
  routes: [
    {
      id: "account",
      title: "账号与同步",
      icon: UserRound,
      hiddenNav: true,
      Component: AccountPage,
    },
  ],
};
