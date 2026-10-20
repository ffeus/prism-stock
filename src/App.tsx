import { lazy, Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import { AppShell } from "@/layout/AppShell";
import { FeedbackProvider } from "@/components/Workbench";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/hooks/useNavigation";
import { useEngineConnection } from "@/hooks/useEngineConnection";
import { ExceptionSummary } from "@/features/monitor/ExceptionSummary";
import { UpdateNotice } from "@/features/settings/UpdateNotice";

const Dashboard = lazy(() => import("@/pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const Tasks = lazy(() => import("@/pages/TasksPage").then(module => ({ default: module.TasksPage })));
const Products = lazy(() => import("@/pages/ProductsPage").then(module => ({ default: module.ProductsPage })));
const History = lazy(() => import("@/pages/HistoryPage").then(module => ({ default: module.HistoryPage })));
const Notifications = lazy(() => import("@/pages/NotificationsPage").then(module => ({ default: module.NotificationsPage })));
const Checkout = lazy(() => import("@/pages/CheckoutPage").then(module => ({ default: module.CheckoutPage })));
const Settings = lazy(() => import("@/pages/SettingsPage").then(module => ({ default: module.SettingsPage })));

export default function App() {
  const { page, navigate } = useNavigation();
  const connection = useEngineConnection();
  return <FeedbackProvider><TooltipProvider delayDuration={180}><AppShell page={page} navigate={navigate}>
    {connection.error && <section className="connection-error" role="alert"><strong>本地监控引擎连接失败</strong><details><summary>查看详情</summary><p>{connection.error}</p></details><Button variant="outline" size="sm" disabled={connection.busy} onClick={() => void connection.retry()}>重新连接</Button></section>}
    <UpdateNotice /><ExceptionSummary />
    {!connection.connected && !connection.error && <div className="page-loading" role="status"><LoaderCircle className="animate-spin" />正在读取本机设置…</div>}
    {connection.connected && <Suspense fallback={<div className="page-loading" role="status"><LoaderCircle className="animate-spin" />正在载入页面…</div>}>
      {page === "dashboard" && <Dashboard navigate={navigate} />}
      {page === "tasks" && <Tasks />}
      {page === "products" && <Products onCreated={() => navigate("tasks")} />}
      {page === "history" && <History />}
      {page === "notifications" && <Notifications />}
      {page === "checkout" && <Checkout />}
      {page === "settings" && <Settings />}
    </Suspense>}
  </AppShell></TooltipProvider></FeedbackProvider>;
}
