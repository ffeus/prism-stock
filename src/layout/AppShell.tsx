import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, Bell, ChevronRight, CircleHelp, Command, History, LayoutDashboard, ListChecks, LoaderCircle, Package, Pause, Play, Settings2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Command as CommandBox, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { useWatcher } from "@/hooks/useWatcher";
import { pages, pageTitles, type PageId } from "@/hooks/useNavigation";
import { startWatching, stopWatching, openProjectPage, queryOnce } from "@/lib/store";
import { isInventoryBrowser } from "@/services/runtime";
import { BRAND } from "@/lib/brand";
import { ThemeControl } from "@/components/PrismHero";
import { useFeedback } from "@/components/Workbench";

const icons = { dashboard: LayoutDashboard, tasks: ListChecks, products: Package, history: History, notifications: Bell, checkout: ShoppingBag, settings: Settings2 };

function EngineControls() {
  const ui = useWatcher();
  const feedback = useFeedback();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!ui.running || !ui.nextCheckAtMs) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [ui.running, ui.nextCheckAtMs]);
  const seconds = ui.nextCheckAtMs ? Math.max(0, Math.ceil((ui.nextCheckAtMs - now) / 1000)) : 0;
  const status = !ui.ready ? "连接中" : !ui.running ? "已暂停" : ui.cooling ? "冷却中" : ui.trouble ? "运行异常" : "监控中";
  return <div className="engine-controls"><span className={`engine-status ${ui.running ? ui.cooling || ui.trouble ? "status-warning" : "status-active" : ""}`} role="status"><i />{status}{ui.running && seconds > 0 && <small>{seconds} 秒后检查</small>}</span>
    {isInventoryBrowser && <Button variant="outline" disabled={!ui.ready || busy || ui.running || !ui.rows.length} onClick={async () => {setBusy(true);const ok=await queryOnce();feedback(ok?"已启动真实查询，首轮完成后自动暂停":"未能启动查询，请查看历史记录的活动日志",!ok);setBusy(false);}}>查询一次</Button>}
    <Button disabled={!ui.ready || busy || (!ui.running && !ui.rows.length)} variant={ui.running ? "outline" : "default"} onClick={async () => {
      setBusy(true); const wasRunning = ui.running;
      const ok = await (wasRunning ? stopWatching() : startWatching());
      feedback(ok ? wasRunning ? "监控已暂停" : "监控已启动" : "操作未完成，请查看异常摘要或活动日志", !ok); setBusy(false);
    }}>{busy ? <LoaderCircle className="animate-spin" /> : ui.running ? <Pause /> : <Play />}{ui.running ? "暂停监控" : "开始监控"}</Button>
  </div>;
}

export function AppShell({ page, navigate, children }: { page: PageId; navigate: (page: PageId) => void; children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(value => !value); } };
    window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => { document.title = `${pageTitles[page]} · ${BRAND.name} V2`; }, [page]);
  return <div className="workbench-shell">
    <a className="skip-link" href="#page-content">跳到主内容</a>
    <aside className="app-sidebar"><div className="workspace-brand"><img src="/prism.svg" alt="" /><div><strong>{BRAND.name}</strong><span>库存工作台 <b>V2</b></span></div></div>
      <button className="quick-search" onClick={() => setCommandOpen(true)} aria-label="快速导航"><Command size={15} /><span>快速导航</span><kbd>Ctrl K</kbd></button>
      <div className="nav-section-label">工作空间</div><nav aria-label="主导航">{pages.map(id => { const Icon = icons[id]; return <button key={id} className={`nav-item ${page === id ? "is-active" : ""}`} aria-current={page === id ? "page" : undefined} title={pageTitles[id]} onClick={() => navigate(id)}><Icon size={18} /><span>{pageTitles[id]}</span></button>; })}</nav>
      <div className="sidebar-bottom"><div className="local-workspace"><span className="local-dot" /><div><strong>本地工作空间</strong><small>数据保存在当前设备</small></div></div>
        <button className="sidebar-source" onClick={() => void openProjectPage()} title="来源与许可"><CircleHelp size={16} /><span>来源与许可</span><ArrowUpRight size={13} /></button><span className="license-note">GPL-3.0 · 独立衍生版</span></div>
    </aside>
    <div className="workspace-main"><header className="app-topbar"><div className="breadcrumb"><Activity size={16} /><span>工作空间</span><ChevronRight size={13} /><strong>{pageTitles[page]}</strong></div><div className="topbar-actions"><ThemeControl /><EngineControls /></div></header>
      <main id="page-content" className="page-content" tabIndex={-1}>{children}</main>
      <footer className="workspace-footer"><span>{BRAND.name} V2 · 非 Apple 官方应用{isInventoryBrowser ? " · 本机实时查询" : ""}</span><span>{isInventoryBrowser ? "关闭全部实时页面 10 秒后暂停；不执行下单" : "关闭窗口后可在系统托盘继续管理"}</span></footer>
    </div>
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}><DialogContent className="command-dialog"><DialogHeader><DialogTitle>快速导航</DialogTitle><DialogDescription>搜索页面名称。按 Esc 关闭。</DialogDescription></DialogHeader><CommandBox><CommandInput placeholder="前往哪个页面？" /><CommandList><CommandEmpty>未找到页面</CommandEmpty><CommandGroup>{pages.map(id => { const Icon = icons[id]; return <CommandItem key={id} value={pageTitles[id]} onSelect={() => { navigate(id); setCommandOpen(false); }}><Icon />{pageTitles[id]}</CommandItem>; })}</CommandGroup></CommandList></CommandBox></DialogContent></Dialog>
  </div>;
}
