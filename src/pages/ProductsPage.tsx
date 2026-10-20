import { useMemo, useState } from "react";
import { Check, Plus, RefreshCw } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { ProductPicker, StorePicker } from "@/components/CatalogPicker";
import { Combobox } from "@/components/Combobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeading, useFeedback } from "@/components/Workbench";
import { addTargets, changeLocale, refreshProducts, setCategory } from "@/lib/store";
import { targetKey, type Target } from "@/lib/types";
import { isInventoryBrowser } from "@/services/runtime";

export function ProductsPage({ onCreated, compact = false }: { onCreated?: () => void; compact?: boolean }) {
  const ui = useWatcher(); const feedback = useFeedback();
  const [parts, setParts] = useState<string[]>([]); const [stores, setStores] = useState<string[]>([]);
  const [busy, setBusy] = useState(false); const [confirm, setConfirm] = useState(false);
  const products = useMemo(() => ui.products.filter(product => product.category === ui.category), [ui.products, ui.category]);
  const pending = useMemo(() => {
    const existing = new Set(ui.rows.map(row => targetKey(row.target))); const next: Target[] = [];
    for (const store of ui.stores.filter(store => stores.includes(store.number))) for (const product of products.filter(product => parts.includes(product.partNumber))) {
      const target: Target = { locale: ui.settings.locale, storeNumber: store.number, storeTitle: store.title, partNumber: product.partNumber, productName: product.title,
        ...(product.companionPart ? { companionPart: product.companionPart } : {}), ...(product.kitPart ? { kitPart: product.kitPart } : {}) };
      if (!existing.has(targetKey(target))) { next.push(target); existing.add(targetKey(target)); }
    }
    return next;
  }, [parts, stores, products, ui.rows, ui.stores, ui.settings.locale]);
  const disabled = !ui.ready || busy || ui.catalogLoading;
  const create = async () => { if (disabled || ui.catalogLocale !== ui.settings.locale || !pending.length) return; setBusy(true); const ok = await addTargets(pending); setBusy(false); feedback(ok ? `已添加 ${pending.length} 条监控` : "添加失败，请查看活动日志", !ok); if (ok) { setParts([]); onCreated?.(); } };
  return <div className={compact ? "product-workflow compact" : "product-workflow"}>
    {!compact && <PageHeading title="商品管理" description={isInventoryBrowser ? "使用完整内置目录选品，库存结果由本机 Rust 实时查询；最多 20 条监控。" : "沿用原版完整目录，按系列与配置找到精确 SKU。"} actions={<Button variant="outline" disabled={isInventoryBrowser || ui.refreshing || disabled} onClick={async () => { const ok = await refreshProducts(); feedback(ok ? "商品与门店目录已更新" : "目录更新未全部成功，保留可用目录；详情见历史记录的活动日志", !ok); }}><RefreshCw className={ui.refreshing ? "animate-spin" : ""} />{isInventoryBrowser ? "使用内置目录" : ui.refreshing ? "更新中" : "更新官网目录"}</Button>} />}
    <section className="surface-panel catalog-browser"><div className="catalog-toolbar"><div><span className="field-caption">购买地区</span><Combobox options={ui.regions.map(region => ({ value: region.locale, label: region.title }))} value={ui.settings.locale} onChange={locale => { setParts([]); setStores([]); void changeLocale(locale); }} placeholder="选择地区" searchPlaceholder="搜索地区…" emptyText="无匹配地区" disabled={disabled} className="control-surface" /></div><span className="catalog-count">{ui.products.length} 个 SKU <span> / </span>{ui.stores.length} 家门店</span></div>
      <div className="category-tabs" role="tablist" aria-label="商品品类">{ui.categories.map(category => <button key={category.value} role="tab" aria-selected={ui.category === category.value} disabled={disabled} onClick={() => { setParts([]); setCategory(category.value); }}>{category.title}<small>{ui.products.filter(product => product.category === category.value).length}</small></button>)}</div>
      {ui.catalogLoading && <p className="inline-status" role="status">正在载入地区目录…</p>}{ui.catalogError && <p className="inline-error" role="alert">{ui.catalogError}</p>}
      <div className="catalog-columns"><ProductPicker key={`${ui.settings.locale}-${ui.category}`} products={products} values={parts} onChange={setParts} disabled={disabled} /><StorePicker key={ui.settings.locale} stores={ui.stores} values={stores} onChange={setStores} disabled={disabled} /></div>
      {ui.category === "watch" && <p className="field-note">使用目录默认表带；创建后可在任务详情按款式、颜色、尺码选择精确表带。</p>}
      <div className="selection-bar"><div><strong>{parts.length} 个 SKU <span>×</span> {stores.length} 家门店</strong><p>{pending.length ? `将新增 ${pending.length} 条监控${parts.length * stores.length > pending.length ? `，跳过 ${parts.length * stores.length - pending.length} 条已有组合` : ""}` : parts.length && stores.length ? "所选组合已在监控列表中" : "先选商品配置，再选要关注的门店"}</p></div><Button disabled={disabled || !pending.length || ui.catalogLocale !== ui.settings.locale} onClick={() => pending.length > 50 ? setConfirm(true) : void create()}>{busy ? <Check /> : <Plus />}{busy ? "正在添加" : pending.length ? `添加 ${pending.length} 项` : "添加监控"}</Button></div>
    </section>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>确认批量添加</DialogTitle><DialogDescription>所选商品与门店将新增 {pending.length} 条监控。数量较多会延长每轮查询，请确认所有组合都需要关注。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>返回调整</Button><Button onClick={() => { setConfirm(false); void create(); }}>确认添加</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
