/** Offline preview bridge for the original repository's snapshots.
 * The desktop app continues to use apw-core's parser through Tauri IPC.
 * Keep SKU acceptance and missing-dimension handling aligned with RawProduct.
 */
import type { Category, Product, Store } from "../../src/lib/types.ts";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const categories = new Set(["iphone", "ipad", "mac", "watch"]);
const words: Record<string, string> = { iphone: "iPhone", ipad: "iPad", imac: "iMac", macbook: "MacBook", mac: "Mac", apple: "Apple", watch: "Watch", air: "Air", duo: "Duo", pro: "Pro", max: "Max", mini: "mini", se: "SE", ultra: "Ultra", studio: "Studio", display: "Display", xdr: "XDR", hermes: "Hermès", neo: "Neo", plus: "Plus" };
const chip = (value: string): string => /^([am])(\d+)(pro|max|ultra)?$/i.test(value)
  ? value.replace(/^([am])(\d+)(pro|max|ultra)?$/i, (_, letter, digits, suffix) => `${letter.toUpperCase()}${digits}${suffix ? ` ${words[suffix.toLowerCase()]}` : ""}`) : "";
const slugName = (value: string) => value.split("-").map(word => words[word] ?? word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

function plain(value: unknown): string {
  return text(value).replace(/<\/?(?:div|p|br|as-footnote|sup)\b[^>]*>|<span\b[^>]*class=["'][^"']*form-label-small[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "").split(/[\r\n]+/).map(segment => segment
      .replace(/&nbsp;|&#160;|&#xA0;/gi, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (entity, decimal, hex) => {
        const code = Number.parseInt(decimal ?? hex, decimal ? 10 : 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
      }).replace(/\s+/g, " ").trim()).find(Boolean) ?? "";
}

function familyName(family: string, slug: string): string {
  const [head = "", ...suffixes] = family.toLowerCase().split("_");
  const prefix = head.startsWith("iphone") ? "iphone" : head.startsWith("ipad") ? "ipad" : "";
  if (!prefix) return slugName(slug);
  const tokens = head.slice(prefix.length).match(/pro|max|plus|mini|air|duo|se|e|[a-z]+\d*|\d+/g) ?? [];
  let name = words[prefix]!;
  for (const token of tokens) name += token === "e" && /\d$/.test(name) ? "e" : ` ${words[token] ?? token.toUpperCase()}`;
  if (prefix === "ipad") {
    if (/\b(?:Air|Pro) \d+$/.test(name)) name += " 英寸";
    for (const suffix of suffixes) if (chip(suffix)) name += ` (${chip(suffix)})`;
  }
  return name;
}

const dimensionName = (key: string) => key.includes("-dimension") ? key.slice(key.indexOf("-dimension") + 1) : key;
const rank = (key: string) => ({ dimensionScreensize: 10, dimensionCaseSize: 20, dimensionCaseMaterial: 30, dimensionChip: 40, dimensionMemory: 55, dimensionCapacity: 60, dimensionConnection: 70, dimensionFinish: 80, dimensionColor: 90 }[dimensionName(key)] ?? 50);

export function snapshotPart(rawValue: unknown): string {
  const raw = object(rawValue);
  const hasDimensions = Object.values(object(raw.dimensions)).some(value => text(value));
  return text(raw.partNumber) || text(raw.btrOrFdPartNumber) || (hasDimensions && text(raw.part).includes("/") ? text(raw.part) : "");
}

function macFields(url: string): Record<string, string> {
  const tail = url.split("/").at(-1)?.split(/[?#]/)[0] ?? "";
  const fields: Record<string, string> = {};
  const model = /(?:^|-)([am]\d+)(?:-(pro|max|ultra))?(?:-|$)/i.exec(tail);
  if (model) fields.dimensionChip = `${model[1]}${model[2] ?? ""}`.toLowerCase();
  const patterns = { dimensionScreensize: /(\d+(?:\.\d+)?)-inch/, dimensionMemory: /(\d+(?:\.\d+)?[gt]b)-memory/, dimensionCapacity: /(\d+(?:\.\d+)?[gt]b)-storage/, cpu: /(\d+)-core-cpu/, gpu: /(\d+)-core-gpu/ };
  for (const [name, pattern] of Object.entries(patterns)) { const match = pattern.exec(tail); if (match) fields[name] = match[1]! + (name === "dimensionScreensize" ? "inch" : ""); }
  return fields;
}

function macHints(data: RecordValue, raw: RecordValue, dimensions: Record<string, string>): Record<string, string> {
  const normalize = (value: string) => value.replace(/[-_]/g, "").replace(/grey/g, "gray");
  const candidates = array(data.macProductLinks).map(text).filter(Boolean).map(url => ({ url, fields: macFields(url) })).filter(({ url, fields }) =>
    Object.entries(dimensions).every(([key, value]) => {
      const name = dimensionName(key);
      if (["dimensionScreensize", "dimensionChip", "dimensionCapacity"].includes(name)) return fields[name] === value;
      if (name === "dimensionColor") return normalize(url).includes(normalize(value));
      if (name === "dimensionFinish") return ["matte", "nano_texture"].includes(value) ? url.includes("nano-texture") : !url.includes("nano-texture");
      if (name.includes("cpuCoreCount-gpuCoreCount")) { const counts = value.split("-"); return fields.cpu === counts.at(-2) && fields.gpu === counts.at(-1); }
      return true;
    }));
  const result: Record<string, string> = {};
  for (const key of ["dimensionChip", "dimensionScreensize", "dimensionMemory", "dimensionCapacity"]) {
    const value = candidates[0]?.fields[key];
    if (value && candidates.every(candidate => candidate.fields[key] === value)) result[key] = value;
  }
  const chips = [...new Set(text(raw.aosContainerPartNumber).split("_").filter(value => chip(value)).map(value => value.toLowerCase()))];
  if (!result.dimensionChip && chips.length === 1) result.dimensionChip = chips[0]!;
  return result;
}

export function productsFromSnapshot(pages: readonly unknown[]): Product[] {
  const result: Product[] = [];
  const seen = new Set<string>();
  for (const pageValue of pages) {
    const page = object(pageValue); const data = object(page.data);
    const category = text(page.category) as Category; const slug = text(page.family);
    if (!categories.has(category)) continue;
    const examples = array(data.watchProductSelectionDataNoJS).map(object);
    const watchNames = examples.map(example => plain(example.text).split(/[（(]/)[0]!.split(" GPS")[0]!.trim());
    const watchName = watchNames.length && watchNames.every(name => name === watchNames[0] && /^Apple Watch .*\d$/.test(name)) ? watchNames[0] : "";
    for (const rawValue of array(data.products)) {
      const raw = object(rawValue); const partNumber = snapshotPart(raw);
      if (!partNumber || seen.has(partNumber)) continue;
      seen.add(partNumber);
      const family = text(raw.familyType) || slug;
      const dimensions = Object.fromEntries(Object.entries(raw.dimensions === undefined ? raw : object(raw.dimensions))
        .filter(([key, value]) => text(value) && (raw.dimensions !== undefined || (key.startsWith("dimension") && key !== "dimensionSteporder")))
        .map(([key, value]) => [key, text(value)]));
      if (category === "mac") for (const [key, value] of Object.entries(macHints(data, raw, dimensions))) {
        if (!Object.keys(dimensions).some(existing => dimensionName(existing) === key)) dimensions[key] = value;
      }
      if (category === "watch" && examples.length) for (const [name, segments] of Object.entries({ dimensionCaseMaterial: [["-titanium-", "titanium"], ["-aluminium-", "aluminum"], ["-aluminum-", "aluminum"], ["-ceramic-", "ceramic"]], dimensionConnection: [["-cellular-", "gpscell"], ["-gps-", "gps"]] })) {
        if (!Object.keys(dimensions).some(key => dimensionName(key) === name)) {
          const match = segments.find(([segment]) => examples.every(example => text(example.url).split("/").at(-1)?.includes(segment!)));
          if (match) dimensions[name] = match[1]!;
        }
      }
      const product: Product = { partNumber, category, family, capacity: "", color: "", title: "",
        ...(text(data.companionPart) ? { companionPart: text(data.companionPart) } : {}), ...(text(data.kitPart) ? { kitPart: text(data.kitPart) } : {}) };
      const labels = [category === "watch" && watchName ? watchName : familyName(family, slug)];
      for (const [key, value] of Object.entries(dimensions).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))) {
        const name = dimensionName(key);
        const entry = [data.displayValues, data.mainDisplayValues].map(group => object(object(object(group)[key])[value])).find(entry => [entry.value, entry.header, entry.text].some(value => plain(value)));
        let label = entry ? [entry.value, entry.header, entry.text].map(plain).find(Boolean) ?? "" : "";
        if (name === "dimensionCapacity") { product.capacity = value.replace(/\s+/g, "").toUpperCase(); label = product.capacity + (category === "mac" ? " 存储" : ""); }
        if (name === "dimensionChip" && category === "mac") label = chip(value) || label;
        if (name.includes("cpuCoreCount-gpuCoreCount") && category === "mac") { const numbers = value.split("-"); if (numbers.length >= 2) label = `${numbers.at(-2)} 核 CPU / ${numbers.at(-1)} 核 GPU`; }
        if (name === "dimensionMemory" && category === "mac") label = `${value.toUpperCase()} 内存`;
        if (name === "dimensionScreensize") { if (text(raw.familyType).startsWith("iphone") || text(raw.familyType).startsWith("ipad")) continue; label = /^(\d+(?:\.\d+)?)inch$/.test(value) ? value.replace("inch", " 英寸") : label; }
        if (name === "dimensionCaseSize") { product.watchCaseSize = value; label = value.replace("mm", " 毫米"); }
        if (category === "watch" && name === "dimensionCaseMaterial") label = ({ aluminum: "铝金属", aluminium: "铝金属", titanium: "钛金属", ceramic: "陶瓷" }[value] ?? label);
        if (category === "watch" && name === "dimensionConnection") label = ({ gps: "GPS", gpscell: "GPS + 蜂窝网络" }[value] ?? label);
        if (!label) label = value; // Preserve unknown specifications in offline preview rather than omit a SKU.
        if (name === "dimensionColor") product.color = label;
        labels.push(label);
      }
      product.title = labels.filter(Boolean).join(" "); result.push(product);
    }
  }
  const counts = new Map<string, number>();
  for (const product of result) counts.set(product.title, (counts.get(product.title) ?? 0) + 1);
  for (const product of result) if (counts.get(product.title)! > 1) product.title += ` ${product.partNumber}`;
  return result;
}

export function storesFromSnapshot(regions: readonly unknown[], locale: string): Store[] {
  const region = regions.map(object).find(region => region.locale === locale);
  if (!region) return [];
  const result: Store[] = []; const seen = new Set<string>();
  const add = (rawValue: unknown, stateName = "") => {
    const raw = object(rawValue); const address = object(raw.address); const number = text(raw.id); const name = text(raw.name);
    if (!number || seen.has(number)) return;
    seen.add(number);
    const area = locale !== "zh_CN" && region.hasStates ? text(address.stateName) || stateName || text(address.city) : text(address.city);
    result.push({ number, name, title: area ? `${area}-${name}` : name });
  };
  for (const stateValue of array(region.state)) { const state = object(stateValue); for (const store of array(state.store)) add(store, text(state.name)); }
  for (const store of array(region.store)) add(store);
  return result;
}
