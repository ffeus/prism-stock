import type { Settings, Product, Store, TargetState } from "../../src/lib/types";
import storeSnapshot from "../../crates/apw-core/data/stores.json";
import { productsFromSnapshot, storesFromSnapshot } from "./catalog-from-snapshot";

const snapshots = import.meta.glob<unknown[]>("../../crates/apw-core/data/products_*.json", { eager: true, import: "default" });
const productsByLocale = new Map(Object.entries(snapshots).map(([path, pages]) => [path.match(/products_(\w+)\.json$/)![1]!, productsFromSnapshot(pages)]));
const getProducts = (locale: string): Product[] => productsByLocale.get(locale) ?? [];
const getStores = (locale: string): Store[] => storesFromSnapshot(storeSnapshot, locale);
const regions = [{ title: "中国大陆", locale: "zh_CN" }, { title: "中国香港", locale: "zh_HK" }, { title: "中国台湾", locale: "zh_TW" }, { title: "日本", locale: "ja_JP" }, { title: "Singapore", locale: "en_SG" }, { title: "Australia", locale: "en_AU" }, { title: "Malaysia", locale: "en_MY" }];

let settings: Settings = {
  locale: "zh_CN", targets: [], deliveryRegion: null, intervalSeconds: 30, barkUrl: "", productBarkUrls: {}, soundEnabled: false, openOnHit: "none", stopOnHit: false,
  network: { mode: "system", clash: { controller: "http://127.0.0.1:9097", secret: "", group: "果到雷达", proxyPort: 7899, nodeFilter: "", pinnedNode: "DIRECT" } },
  checkout: { enabled: false, nationalIdSuffix: "", payment: "alipay", installmentBank: "招商银行", installmentPeriods: 24, placeOrder: false, acceptNearestStore: false, product: "", fillContact: false, contactLastName: "", contactFirstName: "", contactEmail: "", contactPhone: "" },
};
const storageKey = "prism.v2.test-settings";
try { const saved = localStorage.getItem(storageKey); if (saved) settings = JSON.parse(saved); } catch { /* Isolated fixture only. */ }
let running = false;
let snapshot: TargetState[] = [];
let cycle = 0;
const calls: { command: string; args: Record<string, unknown> }[] = [];
const failures = new Set<string>();
const persist = () => localStorage.setItem(storageKey, JSON.stringify(settings));
const syncRows = () => { snapshot = settings.targets.map(target => snapshot.find(row => row.target.locale === target.locale && row.target.partNumber === target.partNumber && row.target.storeNumber === target.storeNumber) ?? { target, availability: { kind: "unknown", reason: "not_yet_checked" }, lastCheckedMs: null, consecutiveFailures: 0 }); };
const emit = (channel: string, payload: unknown) => { for (const callback of listeners.get(channel) ?? []) callback({ payload: structuredClone(payload) }); };
// Only this opt-in Vite fixture exposes test controls. Never bundled by production.
Object.assign(window, { __PRISM_TEST__: {
  emit: (payload: unknown) => emit("watcher://event", payload),
  settings: () => structuredClone(settings),
  calls: () => structuredClone(calls),
  failNext: (command: string) => failures.add(command),
  cycle: (kind: "in_stock" | "out_of_stock" | "blocked" | "transport" | "rate_limited") => {
    syncRows(); cycle++;
    snapshot = snapshot.map((row): TargetState => ({ ...row, availability: kind === "blocked" ? { kind: "unknown", reason: "blocked", detail: "HTTP 541" } : kind === "transport" ? { kind: "unknown", reason: "transport", detail: "模拟网络超时" } : kind === "rate_limited" ? { kind: "unknown", reason: "rate_limited" } : kind === "in_stock" ? { kind: "in_stock" } : { kind: "out_of_stock" }, lastCheckedMs: Date.now(), consecutiveFailures: ["blocked", "transport", "rate_limited"].includes(kind) ? row.consecutiveFailures + 1 : 0 }));
    if (kind === "blocked") emit("watcher://event", { type: "trouble", reason: "模拟 HTTP 541 查询被拒绝", advice: "try_another_network" });
    if (kind === "in_stock") for (const state of snapshot) emit("watcher://event", { type: "inStock", state });
    emit("watcher://event", { type: "cycleComplete", cycle, elapsedMs: 420 + cycle * 10, requestCount: 1, reusedResponseCount: 0, nextCheckInSecs: settings.intervalSeconds, cooling: false, healthy: ["in_stock", "out_of_stock"].includes(kind), snapshot });
  }
} });
syncRows();
const listeners = new Map<string, Set<(event: { payload: unknown }) => void>>();
export async function listen(channel: string, callback: (event: { payload: unknown }) => void) {
  const callbacks = listeners.get(channel) ?? new Set(); callbacks.add(callback); listeners.set(channel, callbacks);
  return () => { callbacks.delete(callback); };
}
export async function openUrl() { /* No external navigation in offline tests. */ }
const rows = (): TargetState[] => { syncRows(); return structuredClone(snapshot); };
export async function invoke(command: string, args: Record<string, any> = {}) {
  calls.push({ command, args: structuredClone(args) });
  if (failures.delete(command)) throw new Error(`模拟 ${command} 执行失败`);
  switch (command) {
    case "list_regions": return regions;
    case "list_categories": return [{ value: "iphone", title: "iPhone" }, { value: "ipad", title: "iPad" }, { value: "mac", title: "Mac" }, { value: "watch", title: "Apple Watch" }];
    case "get_settings": {
      const delay = Number((window as unknown as Record<string, unknown>).__PRISM_TEST_CONNECT_DELAY_MS ?? 0);
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return structuredClone(settings);
    }
    case "get_snapshot": return rows();
    case "is_running": return running;
    case "list_products": return getProducts(args.locale);
    case "list_stores": return getStores(args.locale);
    case "save_settings": settings = structuredClone(args.settings); persist(); return structuredClone(settings);
    case "set_targets": settings.targets = structuredClone(args.targets); if (!settings.targets.length) settings.checkout.enabled = false; persist(); return rows();
    case "set_interval": settings.intervalSeconds = Math.max(5, args.seconds); persist(); return settings.intervalSeconds;
    case "list_delivery_localities": return { states: [{ text: "上海", value: "上海" }], cities: [{ text: "上海", value: "上海" }], districts: [{ text: "浦东新区", value: "浦东新区" }] };
    case "list_watch_band_choices": return [{ styleKey: "sport", styleName: "运动型表带", colorKey: "black", colorName: "黑色" }];
    case "list_watch_band_sizes": return [{ partNumber: "MOCK-BAND/A", text: "M/L" }];
    case "list_clash_nodes": return { now: "DIRECT", nodes: [{ name: "DIRECT", delay: 0, resting: false }, { name: "测试节点", delay: 25, resting: false }] };
    case "select_clash_node": return 0;
    case "test_clash_route": return { version: "Mihomo Mock", now: "DIRECT", nodes: ["DIRECT", "测试节点"], skipped: 0, timeoutCount: 0, portOpen: true };
    case "open_checkout_browser": return undefined;
    case "open_target_product": return undefined;
    case "test_checkout": if (settings.checkout.placeOrder) throw new Error("Mock 安全检查：试跑禁止提交订单"); return "Mock：已到查看订单页；未访问 Apple，未提交订单";
    case "check_for_update": return null;
    case "refresh_products": return { products: getProducts(args.locale).filter(product => product.category === args.category).length, stores: getStores(args.locale).length, errors: ["离线预览读取内置目录，未联网刷新"] };
    case "start_watching": running = true; emit("watcher://event", { type: "runStateChanged", running }); return undefined;
    case "stop_watching": running = false; emit("watcher://event", { type: "runStateChanged", running }); return undefined;
    case "retry_watching_now": return running;
    case "test_notify": return undefined;
    default: throw new Error(`离线预览不执行此操作：${command}`);
  }
}
