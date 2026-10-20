import type { Settings } from "../../lib/types.ts";

/** An explicit allowlist: never export Bark keys, controller secrets or checkout PII. */
export function safeSettingsExport(settings: Settings) {
  return { format: "prism-stock-redacted-v1", locale: settings.locale,
    targets: settings.targets.map(({ locale, storeNumber, storeTitle, partNumber, productName, companionPart, companionName, kitPart }) => ({ locale, storeNumber, storeTitle, partNumber, productName, companionPart, companionName, kitPart })),
    intervalSeconds: settings.intervalSeconds, soundEnabled: settings.soundEnabled, openOnHit: settings.openOnHit, stopOnHit: settings.stopOnHit, networkMode: settings.network.mode };
}
