import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

// Apply before first paint; ThemeControl owns the system listener and cleanup.
let theme = "system";
try { theme = localStorage.getItem("prism.theme") ?? "system"; } catch { /* Storage can be unavailable. */ }
document.documentElement.classList.toggle("dark", theme === "dark" || (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
