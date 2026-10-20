import { useMemo, useState } from "react";
import { ArrowDownUp, Ellipsis, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { PageHeading, EmptyState, useFeedback } from "@/components/Workbench";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/features/monitor/StatusDisplay";
import { TaskDetails, EditTask } from "@/features/monitor/TaskDialogs";
import { ProductsPage } from "./ProductsPage";
import { targetKey, formatTime, type Target, type TargetState } from "@/lib/types";
import { sortMonitorsNewestFirst } from "@/lib/productOrder";
import { removeTarget } from "@/lib/store";

export function TasksPage() {
  const ui = useWatcher(); const feedback = useFeedback(); const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false); const [details, setDetails] = useState<string | null>(null); const [editing, setEditing] = useState<Target | null>(null); const [deleting, setDeleting] = useState<Target | null>(null); const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = sortMonitorsNewestFirst(ui.rows).filter(row => (filter === "all" || row.availability.kind === filter) && terms.every(term => `${row.target.productName} ${row.target.partNumber} ${row.target.storeTitle} ${row.target.storeNumber}`.toLocaleLowerCase().includes(term)));
    if (sort === "store") rows.sort((a, b) => a.target.storeTitle.localeCompare(b.target.storeTitle, "zh-CN"));
    if (sort === "checked") rows.sort((a, b) => (b.lastCheckedMs ?? 0) - (a.lastCheckedMs ?? 0));
    if (sort === "stock") rows.sort((a, b) => Number(b.availability.kind === "in_stock") - Number(a.availability.kind === "in_stock"));
    return rows;
  }, [ui.rows, query, filter, sort]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 25)); const current = Math.min(page, pageCount - 1); const selected = ui.rows.find(row => targetKey(row.target) === details);
  const change = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(0); };
  const rowView = (row: TargetState) => <div role="row" className="task-table-row" key={targetKey(row.target)}>
    <div role="cell" data-label="状态"><StatusBadge availability={row.availability} pickupDetails={row.pickupDetails} /></div>
    <div role="cell" data-label="商品" className="task-product"><button onClick={() => setDetails(targetKey(row.target))} className="task-name">{row.target.productName}</button><span className="task-sku select-text">{row.target.partNumber}</span></div>
    <div role="cell" data-label="门店"><strong>{row.target.storeTitle}</strong><span className="task-sku">{row.target.storeNumber}</span></div>
    <div role="cell" data-label="最后检查" className="task-time">{formatTime(row.lastCheckedMs)}</div>
    <div role="cell" className="task-actions"><Button variant="ghost" size="icon-sm" aria-label="查看监控详情" onClick={() => setDetails(targetKey(row.target))}><Eye /></Button><Button variant="ghost" size="icon-sm" aria-label="编辑这条监控" onClick={() => setEditing(row.target)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="删除这条监控" onClick={() => setDeleting(row.target)}><Trash2 /></Button></div>
  </div>;
  return <><PageHeading title="监控任务" description="集中管理关注的商品与门店，查询结果会在每轮完成后更新。" actions={<Button disabled={!ui.ready} onClick={() => setCreating(true)}><Plus />新建监控</Button>} />
    <section className="surface-panel task-panel"><div className="table-toolbar"><div className="search-field"><Search size={16} /><Input value={query} onChange={event => change(setQuery)(event.target.value)} aria-label="搜索监控任务" placeholder="搜索商品、SKU 或门店" /></div><Select value={filter} onValueChange={change(setFilter)}><SelectTrigger aria-label="按库存状态筛选"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="in_stock">有货</SelectItem><SelectItem value="out_of_stock">无货</SelectItem><SelectItem value="unknown">未知 / 待查</SelectItem></SelectContent></Select><Select value={sort} onValueChange={change(setSort)}><SelectTrigger aria-label="任务排序"><ArrowDownUp size={14} /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">新款优先</SelectItem><SelectItem value="store">按门店</SelectItem><SelectItem value="checked">最近检查</SelectItem><SelectItem value="stock">有货优先</SelectItem></SelectContent></Select></div>
      {rows.length ? <div className="task-table" role="table" aria-label="监控任务列表"><div className="task-table-header" role="row"><span role="columnheader">取货状态</span><span role="columnheader">商品与配置</span><span role="columnheader">门店</span><span role="columnheader">最后检查</span><span role="columnheader"><Ellipsis size={16} /></span></div>{rows.slice(current * 25, current * 25 + 25).map(rowView)}</div> : <EmptyState title={ui.rows.length ? "没有符合筛选条件的监控" : "还没有监控任务"} description={ui.rows.length ? "调整搜索或状态筛选；后台监控范围不会随筛选改变。" : "选一款商品和需要关注的门店，开始你的第一条监控。"} action={!ui.rows.length && <Button variant="outline" disabled={!ui.ready} onClick={() => setCreating(true)}><Plus />创建第一条监控</Button>} />}
      <div className="table-footer"><span>{rows.length} 条结果 · 共 {ui.rows.length} 条监控</span><div><Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>上一页</Button><span>{current + 1} / {pageCount}</span><Button size="sm" variant="ghost" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>下一页</Button></div></div>
    </section>
    <Dialog open={creating} onOpenChange={setCreating}><DialogContent className="create-task-dialog"><DialogHeader><DialogTitle>新建监控</DialogTitle><DialogDescription>选择 SKU 与门店，可同时创建多个组合。</DialogDescription></DialogHeader><ProductsPage compact onCreated={() => setCreating(false)} /></DialogContent></Dialog>
    {selected && <TaskDetails row={selected} onClose={() => setDetails(null)} onEdit={() => { setEditing(selected.target); setDetails(null); }} />}
    {editing && <EditTask target={editing} onClose={() => setEditing(null)} />}
    <Dialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent><DialogHeader><DialogTitle>移除这条监控？</DialogTitle><DialogDescription>{deleting?.productName} · {deleting?.storeTitle}。只移除监控，已开始的结账流程不会因此取消。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>保留监控</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (!deleting) return; setBusy(true); const ok = await removeTarget(deleting); setBusy(false); feedback(ok ? "监控已移除" : "移除失败，请稍后重试", !ok); if (ok) setDeleting(null); }}>确认移除</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
