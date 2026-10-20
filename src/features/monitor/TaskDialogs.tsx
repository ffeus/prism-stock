import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/Combobox";
import { useWatcher } from "@/hooks/useWatcher";
import { invokeDesktop } from "@/services/ipc";
import { openTargetProduct, replaceTarget } from "@/lib/store";
import { formatTime, type Product, type Store, type Target, type TargetState } from "@/lib/types";
import { StatusBadge, DeliveryBadge } from "./StatusDisplay";
import { ProductBarkRoute } from "./ProductBarkRoute";
import { WatchBandPicker } from "./WatchBandPicker";
import { useFeedback } from "@/components/Workbench";
import { isInventoryBrowser } from "@/services/runtime";

function useTargetCatalog(locale: string) {
  const [catalog, setCatalog] = useState<{ products: Product[]; stores: Store[]; loading: boolean; error: string | null }>({ products: [], stores: [], loading: true, error: null });
  useEffect(() => { let active = true; setCatalog({ products: [], stores: [], loading: true, error: null });
    void Promise.all([invokeDesktop<Product[]>("list_products", { locale }), invokeDesktop<Store[]>("list_stores", { locale })])
      .then(([products, stores]) => { if (active) setCatalog({ products, stores, loading: false, error: null }); })
      .catch(error => { if (active) setCatalog({ products: [], stores: [], loading: false, error: String(error) }); });
    return () => { active = false; };
  }, [locale]); return catalog;
}

export function TaskDetails({ row, onClose, onEdit }: { row: TargetState; onClose: () => void; onEdit: () => void }) {
  const ui = useWatcher(); const catalog = useTargetCatalog(row.target.locale);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="task-detail-dialog"><DialogHeader><DialogTitle>监控详情</DialogTitle><DialogDescription className="select-text">{row.target.productName}</DialogDescription></DialogHeader>
    <div className="detail-metadata"><StatusBadge availability={row.availability} pickupDetails={row.pickupDetails} /><dl><div><dt>门店</dt><dd>{row.target.storeTitle} · {row.target.storeNumber}</dd></div><div><dt>地区</dt><dd>{ui.regions.find(region => region.locale === row.target.locale)?.title ?? row.target.locale}</dd></div><div><dt>零件号</dt><dd className="select-text">{row.target.partNumber}</dd></div><div><dt>最后检查</dt><dd>{formatTime(row.lastCheckedMs)}</dd></div><div><dt>预计送货</dt><dd><DeliveryBadge pickupDetails={row.pickupDetails} lastCheckedMs={row.lastCheckedMs} /></dd></div><div><dt>推送路由</dt><dd><ProductBarkRoute target={row.target} customUrl={ui.settings.productBarkUrls[row.target.partNumber]} disabled={isInventoryBrowser} /></dd></div></dl>
      {row.target.companionPart && row.target.kitPart && <WatchBandPicker target={row.target} defaultCompanionPart={catalog.products.find(product => product.partNumber === row.target.partNumber)?.companionPart} disabled={isInventoryBrowser || catalog.loading} />}
      {row.availability.kind === "unknown" && <p className="field-note">当前结果没有给出可信库存结论。{"detail" in row.availability ? row.availability.detail : "请结合异常摘要与查询记录判断。"}</p>}
    </div><DialogFooter><Button variant="outline" disabled={isInventoryBrowser} onClick={() => void openTargetProduct(row.target)}><ExternalLink />打开商品页</Button><Button onClick={onEdit}>编辑监控</Button></DialogFooter></DialogContent></Dialog>;
}

export function EditTask({ target, onClose }: { target: Target; onClose: () => void }) {
  const ui = useWatcher(); const feedback = useFeedback(); const [locale, setLocale] = useState(target.locale);
  const [part, setPart] = useState(target.partNumber); const [store, setStore] = useState(target.storeNumber); const [busy, setBusy] = useState(false);
  const catalog = useTargetCatalog(locale);
  const product = catalog.products.find(product => product.partNumber === part); const selectedStore = catalog.stores.find(item => item.number === store);
  const save = async () => { if (!product || !selectedStore) return; setBusy(true);
    const sameProduct = locale === target.locale && part === target.partNumber;
    const next: Target = { locale, partNumber: part, productName: product.title, storeNumber: store, storeTitle: selectedStore.title,
      ...(sameProduct && target.companionPart ? { companionPart: target.companionPart, companionName: target.companionName, kitPart: target.kitPart } : { companionPart: product.companionPart, kitPart: product.kitPart }) };
    const ok = await replaceTarget(target, next); setBusy(false); feedback(ok ? "监控任务已更新" : "未能更新：组合可能已存在或任务已被移除", !ok); if (ok) onClose();
  };
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>编辑监控</DialogTitle><DialogDescription>更换商品或门店会重新等待查询结果，不修改购物袋或订单。</DialogDescription></DialogHeader><div className="form-stack">
    <label className="field-group"><span>地区</span><Combobox value={locale} options={ui.regions.map(region => ({ value: region.locale, label: region.title }))} onChange={value => { setLocale(value); setPart(""); setStore(""); }} placeholder="编辑地区" searchPlaceholder="搜索地区…" emptyText="无匹配地区" disabled={busy} /></label>
    <div className="field-group"><span>商品型号</span><Combobox value={part} options={catalog.products.map(product => ({ value: product.partNumber, label: product.title }))} onChange={setPart} placeholder="编辑商品型号" searchPlaceholder="搜索系列、容量或颜色…" emptyText="无匹配商品" disabled={busy || catalog.loading} /></div>
    <div className="field-group"><span>取货门店</span><Combobox value={store} options={catalog.stores.map(store => ({ value: store.number, label: store.title }))} onChange={setStore} placeholder="编辑门店" searchPlaceholder="搜索城市或店名…" emptyText="无匹配门店" disabled={busy || catalog.loading} /></div>
    {catalog.loading && <p role="status">正在读取目录…</p>}{catalog.error && <p role="alert" className="inline-error">{catalog.error}</p>}
  </div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy || !product || !selectedStore} onClick={() => void save()}>{busy ? "保存中" : "保存修改"}</Button></DialogFooter></DialogContent></Dialog>;
}
