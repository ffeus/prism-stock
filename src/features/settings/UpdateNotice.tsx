import { Download, X } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describeUpdateProgress, updatePercent } from "@/lib/updateStatus";
import { dismissUpdate, installUpdate, openReleasePage } from "@/lib/store";
export function UpdateNotice() { const ui = useWatcher(); return <>          {ui.update !== null && (
            <Alert className="shrink-0 rounded-2xl border-primary/20 bg-primary/8 px-4 py-3">
              <Download aria-hidden="true" />
              <AlertTitle>{ui.updateInstalled ? "更新已安装" : "发现新版本"} {ui.update.version}</AlertTitle>
              <AlertDescription>
                <span>{ui.updateInstalled ? "请退出并重新打开应用，新版本才会生效。" : `当前版本 ${ui.update.currentVersion}，安装后需重启应用。`}</span>
                {ui.updateProgress !== null && (
                  <div className="w-full space-y-1" role="status" aria-live="polite">
                    <span>{describeUpdateProgress(ui.updateProgress)}</span>
                    {ui.updateProgress.phase === "downloading" && (
                      <progress className="block h-2 w-full max-w-sm accent-primary" aria-label="更新下载进度"
                        max={100} value={updatePercent(ui.updateProgress)} />
                    )}
                  </div>
                )}
                {ui.updateError !== null && <p className="break-words text-destructive" role="alert">{ui.updateError}</p>}
                <div className="mt-1.5 flex items-center gap-2">
                  <Button size="sm" disabled={ui.installing || ui.updateInstalled} onClick={() => void installUpdate()}>
                    {ui.updateInstalled ? "已安装" : ui.installing ? "正在更新…" : ui.updateError ? "重试" : "下载并安装"}
                  </Button>
                  {ui.updateError !== null && (
                    <Button size="sm" variant="outline" onClick={() => void openReleasePage()}>下载安装包</Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={ui.installing} onClick={dismissUpdate}>
                    <X aria-hidden="true" /> 稍后
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

</>; }
