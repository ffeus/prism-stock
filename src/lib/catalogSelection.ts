import type { Product, Store } from "./types.ts";

const order = new Intl.Collator("zh-CN", { numeric: true });
export const UNSPECIFIED = "__unspecified__";
export const dimensionValue = (value?: string) => value?.trim() || UNSPECIFIED;

/** Keys always come from the catalog, never from a guessed product generation. */
export function familyKey(product: Product): string {
  return product.family.trim() || product.title;
}

export function familyLabel(product: Product): string {
  const title = product.title.replace(/\u00a0/g, " ");
  const match = /^(iPhone\s+(?:\d+e?(?:\s+(?:Pro Max|Pro|Plus))?|Air|Duo)|iPad(?:\s+(?:Pro|Air|mini|[AM]\d+))?(?:\s+\d+(?:\.\d+)?\s*英寸)?(?:\s+\([AM]\d+(?:\s+(?:Pro|Max|Ultra))?\))?|MacBook\s+(?:Air|Pro|Neo)|Mac\s+(?:mini|Studio|Pro)|iMac|Studio Display(?: XDR)?|Pro Display XDR|Apple Watch(?:\s+Herm[eè]s)?(?:\s+(?:Series\s*\d+|Ultra\s*\d*|SE\s*\d*))?)/i.exec(title);
  // Keep the catalog family visible when multiple generations share a marketing name.
  return match ? match[0].trim() : product.family.replaceAll("-", " ") || product.title;
}

export interface ProductFilters { family: string; capacity: string; color: string; size: string }
export const emptyProductFilters: ProductFilters = { family: "", capacity: "", color: "", size: "" };

export function filterProducts(products: readonly Product[], filters: ProductFilters): Product[] {
  return products.filter((product) =>
    (!filters.family || familyKey(product) === filters.family)
    && (!filters.capacity || dimensionValue(product.capacity) === filters.capacity)
    && (!filters.color || dimensionValue(product.color) === filters.color)
    && (!filters.size || dimensionValue(product.watchCaseSize) === filters.size));
}

export function dimensionOptions(values: readonly (string | undefined)[]) {
  return [...new Set(values.map(dimensionValue))].sort(order.compare)
    .map((value) => ({ value, label: value === UNSPECIFIED ? "目录未标注" : value }));
}

export function compareCapacity(a: { label: string }, b: { label: string }): number {
  const size = (label: string) => {
    const match = /^(\d+(?:\.\d+)?)\s*(GB|TB)$/i.exec(label);
    return match ? Number(match[1]) * (match[2]!.toUpperCase() === "TB" ? 1024 : 1) : null;
  };
  const left = size(a.label); const right = size(b.label);
  return left !== null && right !== null ? left - right : order.compare(a.label, b.label);
}

/** The legacy IPC intentionally omits structured addresses. Use its display area,
 * not an invented province, postcode, distance or inferred geolocation. */
export function storeArea(store: Store): string {
  const suffix = `-${store.name.trim()}`;
  const title = store.title.trim();
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() || "未标注区域" : "未标注区域";
}

export function mergeVisibleSelection(current: string[], visible: string[], next: string[]): string[] {
  const visibleSet = new Set(visible);
  return [...new Set([...current.filter((value) => !visibleSet.has(value)), ...next])];
}
