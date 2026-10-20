/** Fork branding. Do not point fork updates at upstream binaries. */
export const BRAND = {
  name: "棱镜库存",
  englishName: "Prism Stock",
  upstream: "https://github.com/suversal/apple-store-inventory-monitor",
  repository: "https://github.com/ffeus/prism-stock",
  social: "", // Intentionally hidden until the owner supplies their X profile.
  updatesEnabled: false, // Requires this fork's release endpoint AND signing key.
} as const;
