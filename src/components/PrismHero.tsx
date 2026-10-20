import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";
function initialTheme(): Theme {
  try { const value = localStorage.getItem("prism.theme"); return value === "dark" || value === "light" ? value : "system"; }
  catch { return "system"; }
}

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    const sync = () => setTheme(initialTheme());
    window.addEventListener("prism-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("prism-theme-change", sync); window.removeEventListener("storage", sync); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const next: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
  const labels = { system: "跟随系统", light: "浅色", dark: "深色" };
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return <Button variant="ghost" size="sm" aria-label={`当前${labels[theme]}，切换为${labels[next[theme]]}`} title={`主题：${labels[theme]}`}
    onClick={() => { const value = next[theme]; setTheme(value); try { localStorage.setItem("prism.theme", value); window.dispatchEvent(new Event("prism-theme-change")); } catch { /* Session-only theme still works. */ } }}>
    <Icon size={16} /><span className="hidden sm:inline">{labels[theme]}</span>
  </Button>;
}

export function PrismHero({ tasks, available, running }: { tasks: number; available: number; running: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const reset = () => { cancelAnimationFrame(frame.current); scene.current?.style.removeProperty("--rx"); scene.current?.style.removeProperty("--ry"); };
  return <section className="prism-hero" aria-label="库存工作台概览"
    onPointerMove={(event) => {
      if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => { scene.current?.style.setProperty("--rx", `${-y * 14}deg`); scene.current?.style.setProperty("--ry", `${x * 20}deg`); });
    }} onPointerLeave={reset}>
    <div className="prism-hero-copy"><div className="eyebrow">PRISM STOCK / 库存工作台</div>
      <h2>让每一次到货，<br /><span>清晰可见。</span></h2>
      <p>选好产品，锁定门店。把繁杂的 SKU，变成有序的关注列表。</p>
      <div className="hero-pills"><span><i className={running ? "is-running" : ""} />{running ? "监控运行中" : "等待启动"}</span><span>{tasks} 条监控</span><span>{available} 条有货</span></div>
    </div>
    <div className="prism-scene" ref={scene} aria-hidden="true">
      <div className="prism-orbit orbit-one" /><div className="prism-orbit orbit-two" />
      <div className="prism-object"><div className="prism-face face-front" /><div className="prism-face face-side" /><div className="prism-face face-top" /></div>
      <div className="prism-float float-one">SKU<span>精准配置</span></div><div className="prism-float float-two">STOCK<span>状态可见</span></div>
      <div className="prism-floor" />
    </div>
  </section>;
}
