import { Activity, ArrowRight, Bell, CircleAlert, Clock3, ListChecks, PackageCheck, Radio } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import type { PageId } from "@/hooks/useNavigation";
import { PageHeading, Panel, EmptyState } from "@/components/Workbench";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/monitor/StatusDisplay";
import { sessionMetrics } from "@/features/activity/session";
import { formatTime, isUntrusted, targetKey } from "@/lib/types";

import { isInventoryBrowser } from "@/services/runtime";

export function DashboardPage({ navigate }: { navigate: (page: PageId) => void }) {
  const ui = useWatcher(); const metrics = sessionMetrics(ui.session);
  const inStock = ui.rows.filter(row => row.availability.kind === "in_stock");
  const failed = ui.rows.filter(row => isUntrusted(row.availability));
  const latest = ui.session.cycles.at(-1);
  const points = ui.session.cycles.slice(-24);
  const max = Math.max(1, ...points.map(cycle => cycle.elapsedMs));
  const cards = [
    { title: "监控任务", value: String(ui.rows.length), note: "商品 × 门店组合", icon: ListChecks, tone: "" },
    { title: "当前有货", value: String(inStock.length), note: "最近一次查询结果", icon: PackageCheck, tone: "metric-green" },
    { title: "有效结果率", value: metrics.successRate === null ? "—" : `${metrics.successRate}%`, note: metrics.cycles ? `基于保留的 ${metrics.cycles} 轮查询` : "等待第一轮查询", icon: Activity, tone: "" },
    { title: "待处理异常", value: String(failed.length), note: "未知结果不计为无货", icon: CircleAlert, tone: failed.length ? "metric-amber" : "" },
  ];
  return <><PageHeading title="仪表盘" description="一眼掌握库存与运行情况，重要变化随时可查。" actions={<Button onClick={() => navigate("products")}>创建监控<ArrowRight /></Button>} />
    <div className="metric-grid">{cards.map(card => <section className={`metric-card ${card.tone}`} key={card.title}><div><span>{card.title}</span><card.icon size={17} /></div><strong>{card.value}</strong><small>{card.note}</small></section>)}</div>
    <div className="dashboard-grid"><Panel title="查询活动" description="本次运行 · 最近 24 轮" actions={<span className={`section-badge ${ui.running ? "badge-active" : ""}`}><Radio size={13} />{ui.running ? "运行中" : "已暂停"}</span>}>
      <div className="query-chart">{points.length ? <div className="cycle-bars" aria-label="实际查询耗时"><div className="chart-axis">{(max / 1000).toFixed(1)} 秒</div>{points.map(cycle => <div key={cycle.id} className={`cycle-bar ${cycle.healthy ? "" : "cycle-failed"}`} style={{ height: `${Math.max(3, cycle.elapsedMs / max * 100)}%` }} title={`第 ${cycle.cycle} 轮 · ${cycle.elapsedMs}ms · ${cycle.healthy ? "健康" : "存在异常"}`} />)}</div> : <EmptyState title="等待首次查询" description="创建监控并启动后，这里显示实际查询耗时。" />}</div>
      <div className="chart-summary"><span><Clock3 size={15} />平均耗时 <strong>{metrics.averageMs === null ? "—" : `${(metrics.averageMs / 1000).toFixed(1)} 秒`}</strong></span><span>实际请求 <strong>{metrics.cycles ? metrics.requests : "—"}</strong></span><span>最近完成 <strong>{latest ? formatTime(latest.at) : "—"}</strong></span></div>
    </Panel><Panel title="运行概况" description="本地监控引擎"><dl className="overview-list"><div><dt>当前状态</dt><dd><span className={`local-dot ${ui.running ? "active" : ""}`} />{ui.running ? ui.cooling ? "保护冷却中" : "监控进行中" : "已暂停"}</dd></div><div><dt>查询间隔</dt><dd>{ui.settings.intervalSeconds} 秒</dd></div><div><dt>网络模式</dt><dd>{({ system: "系统代理", pinned: "固定节点", clash: "Clash 线路" })[ui.settings.network.mode]}</dd></div><div><dt>已配置渠道</dt><dd>{[ui.settings.barkUrl ? "Bark" : "", ui.settings.soundEnabled ? "提示音" : ""].filter(Boolean).join("、") || "未设置"}</dd></div><div><dt>到货行为</dt><dd>{ui.settings.stopOnHit ? "提醒后暂停" : "持续监控"}</dd></div></dl><button className="panel-link" onClick={() => navigate("settings")}>管理系统设置<ArrowRight size={15} /></button></Panel></div>
    <div className="dashboard-grid"><Panel title="当前有货" description="基于最近一轮结果，购买前请核对官网" actions={<Button variant="ghost" size="sm" onClick={() => navigate("tasks")}>全部任务<ArrowRight /></Button>}>
      {inStock.length ? <div className="compact-list">{inStock.slice(0, 5).map(row => <div key={targetKey(row.target)}><div><strong>{row.target.productName}</strong><span>{row.target.storeTitle}</span></div><StatusBadge availability={row.availability} pickupDetails={row.pickupDetails} /></div>)}</div> : <EmptyState title="暂未收到有货结果" description={ui.rows.length ? "保持监控，查询结果会在这里更新。" : "添加你的第一条监控，开始关注到货。"} />}
    </Panel><Panel title="最近提醒" description="显示实际触发与测试记录" actions={<Bell size={16} />}>
      {ui.session.notifications.length ? <div className="compact-list">{ui.session.notifications.slice(-4).reverse().map(record => <div key={record.id}><div><strong>{record.title}</strong><span>{record.kind === "triggered" ? isInventoryBrowser ? "本机到货事件 · 未发送推送" : "到货事件 · 渠道送达状态未回传" : record.detail}</span></div><time>{formatTime(record.at)}</time></div>)}</div> : <EmptyState title="还没有提醒记录" description="到货事件或手动测试的结果会显示在这里。" />}
    </Panel></div>
    <p className="session-caption">统计范围：当前会话保留的最近 120 轮。有效结果率仅统计明确有货或无货的结果，未知状态不计入成功。</p>
  </>;
}
