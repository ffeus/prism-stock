import { useCallback, useEffect, useState } from "react";

export const pages = ["dashboard", "tasks", "products", "history", "notifications", "checkout", "settings"] as const;
export type PageId = typeof pages[number];
export const pageTitles: Record<PageId, string> = { dashboard: "仪表盘", tasks: "监控任务", products: "商品管理", history: "历史记录", notifications: "通知中心", checkout: "自动结账", settings: "系统设置" };
const currentPage = (): PageId => pages.includes(location.hash.slice(1) as PageId) ? location.hash.slice(1) as PageId : "dashboard";

export function useNavigation() {
  const [page, setPage] = useState<PageId>(currentPage);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [page]);
  useEffect(() => { const change = () => setPage(currentPage()); window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); }, []);
  const navigate = useCallback((next: PageId) => { location.hash = next; setPage(next); }, []);
  return { page, navigate };
}
