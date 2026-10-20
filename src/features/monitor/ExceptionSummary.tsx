import { CircleAlert, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useWatcher } from "@/hooks/useWatcher";
import { describeBrowserFailure, describeBrowserRecovery } from "@/lib/monitorLog";
import { describeAdvice, isUntrusted } from "@/lib/types";
import { retryWatchingNow } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/Workbench";
import { isInventoryBrowser } from "@/services/runtime";

export function ExceptionSummary() {
  const ui = useWatcher(); const [busy, setBusy] = useState(false); const feedback = useFeedback();
  const failed = ui.rows.filter(row => isUntrusted(row.availability));
  const browser = describeBrowserFailure(ui.rows);
  if (!ui.trouble && !failed.length && !browser) return null;
  return <section className="exception-summary" aria-label="异常摘要"><div className="exception-title"><CircleAlert size={17} /><strong>{ui.cooling ? "查询保护冷却中" : browser ? "查询浏览器需要检查" : `${failed.length || "部分"} 项查询需要关注`}</strong><span>失败结果保持未知，不能视为无货。</span></div>
    <details><summary>查看原因与处理建议</summary><div className="exception-details"><p>{ui.trouble?.reason ?? browser ?? "部分目标未取得可信库存结果"}</p>{browser && <ul>{describeBrowserRecovery(browser).map(line => <li key={line}>{line}</li>)}</ul>}{ui.trouble?.advice && <p>{isInventoryBrowser && ui.trouble.advice === "try_another_network" ? "Apple 拒绝了本次查询，服务已暂停，不会自动连续重试。结果保持未知；等待至少 60 秒后可自行决定是否重新查询。" : describeAdvice(ui.trouble.advice)}</p>}
      {failed.slice(0, 3).map(row => <p key={`${row.target.locale}-${row.target.storeNumber}-${row.target.partNumber}`}><strong>{row.target.storeTitle}</strong> · {row.target.productName}：{row.availability.kind === "unknown" && "detail" in row.availability ? row.availability.detail : row.availability.kind === "unknown" ? row.availability.reason : ""}</p>)}
      {!isInventoryBrowser && ui.running && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await retryWatchingNow(); feedback(ok ? "已请求重新检查" : "暂时无法重试，请查看日志", !ok); setBusy(false); }}><RefreshCw />重新检查</Button>}
    </div></details></section>;
}
