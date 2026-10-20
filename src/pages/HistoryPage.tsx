import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { PageHeading, Panel, EmptyState } from "@/components/Workbench";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/features/monitor/StatusDisplay";
import { formatTime } from "@/lib/types";

export function HistoryPage() {
  const ui = useWatcher(); const [query, setQuery] = useState(""); const [mode, setMode] = useState("all"); const [page, setPage] = useState(0);
  const rows = useMemo(() => ui.session.observations.filter(record => (mode !== "changed" || record.changed) && `${record.state.target.productName} ${record.state.target.storeTitle}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).reverse(), [ui.session.observations, query, mode]);
  const pages = Math.max(1, Math.ceil(rows.length / 30)); const current = Math.min(page, pages - 1);
  return <><PageHeading title="历史记录" description="查看本次运行收到的查询结果与库存变化。" /><div className="scope-note"><History size={16} />当前会话 · 最多保留 600 条结果，重启后清空。跨设备及长期历史将作为后续能力。</div>
    <Panel title="查询记录" description={`${rows.length} 条匹配结果`}><div className="table-toolbar"><div className="search-field"><Search size={16} /><Input aria-label="搜索历史记录" placeholder="搜索商品或门店" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></div><Select value={mode} onValueChange={value => { setMode(value); setPage(0); }}><SelectTrigger aria-label="历史记录类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部结果</SelectItem><SelectItem value="changed">仅状态变化</SelectItem></SelectContent></Select></div>
      {rows.length ? <div className="history-list">{rows.slice(current * 30, current * 30 + 30).map(record => <article key={record.id}><div className="history-time"><time>{formatTime(record.at)}</time><span>第 {record.cycle} 轮</span></div><div className="history-product"><strong>{record.state.target.productName}</strong><span>{record.state.target.storeTitle}{record.changed ? " · 状态发生变化" : ""}</span></div><StatusBadge availability={record.state.availability} pickupDetails={record.state.pickupDetails} /></article>)}</div> : <EmptyState title="暂无查询记录" description={mode === "changed" ? "尚未收到符合条件的库存变化。" : "查询完成后会记录真实结果，不会使用演示历史填充。"} />}
      <div className="table-footer"><span>显示 {rows.length ? current * 30 + 1 : 0}–{Math.min((current + 1) * 30, rows.length)} 条</span><div><Button variant="ghost" size="sm" disabled={!current} onClick={() => setPage(current - 1)}>上一页</Button><span>{current + 1}/{pages}</span><Button variant="ghost" size="sm" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>下一页</Button></div></div>
    </Panel><Panel title="活动日志" description={`最新 ${ui.logs.length} 条 · 包含操作结果与详细错误`}><pre className="activity-log select-text">{ui.logs.length ? ui.logs.join("\n") : "等待监控活动…"}</pre></Panel></>;
}
