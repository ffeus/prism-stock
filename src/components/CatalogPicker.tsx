import { useMemo, useState } from "react";
import { Check, Layers3, MapPin, X } from "lucide-react";
import { Combobox } from "@/components/Combobox";
import { MultiCombobox } from "@/components/MultiCombobox";
import { Button } from "@/components/ui/button";
import type { Product, Store } from "@/lib/types";
import { compareNewestProducts } from "@/lib/productOrder";
import { compareCapacity, dimensionOptions, emptyProductFilters, familyKey, familyLabel, filterProducts, mergeVisibleSelection, storeArea, type ProductFilters } from "@/lib/catalogSelection";

function Filter({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean;
}) {
  return <div className="field-group">
    <span className="control-label">{label}</span>
    <Combobox options={[{ value: "", label: `全部${label}` }, ...options]} value={value}
      onChange={onChange} placeholder={`选择${label}`} searchPlaceholder={`搜索${label}…`}
      emptyText="没有匹配项" disabled={disabled} className="control-surface w-full" />
  </div>;
}

function SelectionSummary({ values, labels, onChange, disabled, unit }: {
  values: string[]; labels: Map<string, string>; onChange: (values: string[]) => void; disabled?: boolean; unit: string;
}) {
  if (!values.length) return null;
  return <details className="selection-summary">
    <summary><Check size={14} aria-hidden="true" /> 已选 {values.length} {unit} · 查看与移除</summary>
    <div className="max-h-40 space-y-1 overflow-y-auto pt-2">
      {values.map((value) => <div key={value} className="flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 break-words">{labels.get(value) ?? value}</span>
        <Button size="icon-sm" variant="ghost" disabled={disabled} aria-label={`移除选择 ${labels.get(value) ?? value}`}
          onClick={() => onChange(values.filter((item) => item !== value))}><X size={13} /></Button>
      </div>)}
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange([])}>清空全部选择</Button>
    </div>
  </details>;
}

export function ProductPicker({ products, values, onChange, disabled }: {
  products: Product[]; values: string[]; onChange: (values: string[]) => void; disabled?: boolean;
}) {
  const [filters, setFilters] = useState<ProductFilters>(emptyProductFilters);
  const sorted = useMemo(() => [...products].sort(compareNewestProducts), [products]);
  const families = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const product of sorted) groups.set(familyKey(product), [...(groups.get(familyKey(product)) ?? []), product]);
    return [...groups].map(([key, items]) => ({ key, label: familyLabel(items[0]!), count: items.length }));
  }, [sorted]);
  const family = filters.family || (families.length === 1 ? families[0]!.key : "");
  const base = family ? sorted.filter((product) => familyKey(product) === family) : [];
  const effective = { ...filters, family };
  const visible = filterProducts(base, effective);
  // Each facet is derived from the other facets, so unavailable combinations are not offered.
  const optionsFor = (key: "capacity" | "color" | "size") => {
    const options = dimensionOptions(filterProducts(base, { ...effective, [key]: "" })
      .map((product) => key === "size" ? product.watchCaseSize : product[key]));
    return key === "capacity" ? options.sort(compareCapacity) : options;
  };
  const labels = new Map(products.map((product) => [product.partNumber, product.title]));
  return <div className="catalog-step">
    <div className="catalog-step-heading"><Layers3 size={16} aria-hidden="true" /><span>01 / 选择产品</span><small>系列 → 配置 → SKU</small></div>
    <div className="family-grid" role="group" aria-label="产品系列">
      {families.map((item) => <button type="button" key={item.key} className="family-card" aria-pressed={family === item.key}
        disabled={disabled} onClick={() => setFilters({ ...emptyProductFilters, family: item.key })}>
        <span>{item.label}</span><small>{item.count} 个配置</small>
        {families.filter((other) => other.label === item.label).length > 1 && <small>{item.key}</small>}
      </button>)}
    </div>
    {!families.length && <p className="py-3 text-sm text-muted-foreground">当前目录没有此品类，稍后可手动刷新目录。</p>}
    {!family && families.length > 0 && <p className="py-3 text-sm text-muted-foreground">先选一个系列，不再展开整个品类的全部 SKU。</p>}
    {family && <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-2">
        <Filter label="容量 / 配置" value={filters.capacity} options={optionsFor("capacity")} disabled={disabled}
          onChange={(capacity) => setFilters({ ...effective, capacity })} />
        <Filter label="颜色" value={filters.color} options={optionsFor("color")} disabled={disabled}
          onChange={(color) => setFilters({ ...effective, color })} />
        {base.some((product) => product.watchCaseSize) && <Filter label="表壳尺寸" value={filters.size} options={optionsFor("size")} disabled={disabled}
          onChange={(size) => setFilters({ ...effective, size })} />}
      </div>
      <MultiCombobox className="control-surface w-full" options={visible.map((product) => ({ value: product.partNumber,
        label: product.title, description: `SKU ${product.partNumber}${product.companionPart ? ` · 默认表带 ${product.companionPart}` : ""}` }))}
        values={values.filter((value) => visible.some((product) => product.partNumber === value))}
        onChange={(next) => onChange(mergeVisibleSelection(values, visible.map((product) => product.partNumber), next))}
        placeholder={`选择具体配置 · ${visible.length} 个 SKU`} searchPlaceholder="搜索配置或 SKU…" emptyText="无匹配配置，请重置筛选"
        selectionUnit="个 SKU" disabled={disabled || !visible.length} />
      <p className="text-[11px] leading-4 text-muted-foreground">保留官方目录的完整规格和 SKU，不按名称合并。切换筛选不会丢失已选项。</p>
      {(filters.capacity || filters.color || filters.size) && <Button variant="ghost" size="sm" onClick={() => setFilters({ ...emptyProductFilters, family })} disabled={disabled}>重置配置筛选</Button>}
    </div>}
    <SelectionSummary values={values} labels={labels} onChange={onChange} disabled={disabled} unit="个 SKU" />
  </div>;
}

export function StorePicker({ stores, values, onChange, disabled }: {
  stores: Store[]; values: string[]; onChange: (values: string[]) => void; disabled?: boolean;
}) {
  const [chosenArea, setArea] = useState<string | null>(null);
  const areas = dimensionOptions(stores.map(storeArea));
  const area = chosenArea ?? (areas.length === 1 ? areas[0]!.value : null);
  const visible = area === null ? [] : stores.filter((store) => !area || storeArea(store) === area);
  return <div className="catalog-step">
    <div className="catalog-step-heading"><MapPin size={16} aria-hidden="true" /><span>02 / 选择门店</span><small>城市 / 区域 → 门店</small></div>
    <Filter label="城市 / 区域" value={area ?? "__choose_area__"} options={areas} disabled={disabled} onChange={setArea} />
    <div className="mt-3">
      <MultiCombobox className="control-surface w-full" options={visible.map((store) => ({ value: store.number, label: store.title, description: `Apple Store · ${store.number}` }))}
        values={values.filter((value) => visible.some((store) => store.number === value))}
        onChange={(next) => onChange(mergeVisibleSelection(values, visible.map((store) => store.number), next))}
        placeholder={area === null ? "先选择城市 / 区域" : `选择零售店 · ${visible.length} 家`} searchPlaceholder="搜索城市、店名或门店编号…" emptyText="没有匹配门店"
        selectionUnit="家门店" disabled={disabled || !visible.length} />
    </div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">可跨城市多选。区域按现有目录展示，不代表距离远近；取货库存以具体门店为准。</p>
    <SelectionSummary values={values} labels={new Map(stores.map((store) => [store.number, store.title]))} onChange={onChange} disabled={disabled} unit="家门店" />
  </div>;
}
