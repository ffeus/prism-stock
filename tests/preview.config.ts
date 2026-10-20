import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Separate, opt-in test server. Production vite.config.ts never imports this file.
const mock = path.resolve(__dirname, "fixtures/tauri-preview.ts");
export default defineConfig({
  cacheDir: "node_modules/.vite-preview",
  plugins: [react(), tailwindcss(), { name: "offline-preview-banner", transformIndexHtml: (html) => html.replace("<body>", '<body><div style="padding:8px 20px;background:#44337a;color:white;font:12px system-ui;text-align:center">离线预览 · 商品与门店来自原版内置目录 · 库存和操作为模拟</div>') }],
  resolve: { alias: [
    { find: "@tauri-apps/api/core", replacement: mock },
    { find: "@tauri-apps/api/event", replacement: mock },
    { find: "@tauri-apps/plugin-opener", replacement: mock },
    { find: "@", replacement: path.resolve(__dirname, "../src") },
  ] },
  server: { host: "127.0.0.1", port: 1427, strictPort: true, watch: { ignored: ["**/src-tauri/**", "**/target/**"] } },
});
