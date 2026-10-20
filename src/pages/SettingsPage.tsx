import { useState } from "react";
import { ClipboardCopy, Shield, SlidersHorizontal } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { PageHeading, Panel, useFeedback } from "@/components/Workbench";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NetworkSettings } from "@/components/NetworkSettings";
import { DeliverySettings } from "@/features/settings/DeliverySettings";
import { ThemeControl } from "@/components/PrismHero";
import { safeSettingsExport } from "@/features/settings/safeExport";
import { setIntervalSeconds, checkForUpdate, openProjectPage } from "@/lib/store";
import { BRAND } from "@/lib/brand";
import packageInfo from "../../package.json";
import { isInventoryBrowser } from "@/services/runtime";

export function SettingsPage() {
  const ui = useWatcher(); const feedback = useFeedback(); const [interval, setInterval] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return <><PageHeading title="系统设置" description="管理查询、网络与本机偏好，调整后会保留到下次启动。" />
    <div className="settings-grid"><Panel title="查询与送货" description="合理的间隔有助于减少访问压力"><div className="form-stack"><label htmlFor="interval">查询间隔（秒）</label><div className="inline-form"><Input id="interval" type="number" min={isInventoryBrowser ? 60 : 5} value={interval ?? ui.settings.intervalSeconds} onChange={event => setInterval(event.target.value)} /><Button variant="outline" disabled={busy || interval === null} onClick={async () => { const value = Number(interval); if (!Number.isFinite(value) || value < (isInventoryBrowser ? 60 : 5)) { feedback(`请输入不少于 ${isInventoryBrowser ? 60 : 5} 秒的查询间隔`, true); return; } setBusy(true); const ok = await setIntervalSeconds(Math.round(value)); setBusy(false); if (ok) setInterval(null); feedback(ok ? "查询间隔已保存" : "查询间隔保存失败", !ok); }}>保存间隔</Button></div><p className="field-note">保护冷却可能延长实际等待；不会把被拦截当作无货。</p>{isInventoryBrowser ? <p className="field-note">本机只读模式仅查门店取货库存，最短间隔 60 秒，最多 20 条目标；暂不发起送货地区辅助查询。</p> : <DeliverySettings />}</div></Panel>
      <Panel title="外观与版本" description="适合长时间运行的工作台"><div className="form-stack"><div className="setting-row"><span>主题模式</span><ThemeControl /></div><div className="setting-row"><span>当前版本</span><strong>v{packageInfo.version} · V2</strong></div><p className="field-note">{BRAND.updatesEnabled ? "更新需要你主动确认安装。" : "当前版本暂不提供应用内更新。"}</p>{BRAND.updatesEnabled && <Button variant="outline" onClick={() => void checkForUpdate()}>检查更新</Button>}<Button variant="outline" onClick={() => void openProjectPage()}>查看项目与许可</Button><p className="field-note">开源许可证：GPL-3.0-or-later，完整声明见项目仓库。</p></div></Panel></div>
    <div className="settings-content">{isInventoryBrowser ? <Panel title="查询网络" description="当前仅跟随本机系统代理"><div className="form-stack"><p>库存请求由本机 Rust 服务发起，使用独立浏览器资料目录。此入口不切换 FlClash 节点、不读取已有浏览器登录资料。</p></div></Panel> : <NetworkSettings network={ui.settings.network} running={ui.running} route={ui.route} expanded />}</div>
    <div className="settings-grid"><Panel title="浏览器与运行" description="使用独立查询与结账会话"><div className="form-stack"><p>需要安装 Chrome 或 Edge。查询浏览器与下单浏览器使用各自的资料目录。</p><p className="field-note">启动失败可在顶部异常摘要展开原因与恢复步骤。{isInventoryBrowser ? "关闭全部实时页面 10 秒后自动暂停；退出本机服务会关闭专属查询浏览器。" : "关闭主窗口会收进托盘，完全退出请使用托盘菜单。"}</p><div className="scope-note"><SlidersHorizontal size={16} />FlClash 使用 Mihomo 控制接口；系统代理/TUN 与固定节点是不同出口方式。检查控制端口和密钥后再切换，不覆盖现有 FlClash 配置。</div></div></Panel>
      <Panel title="数据与隐私" description="本地设置继续使用原有兼容格式"><div className="form-stack"><p className="field-note">{isInventoryBrowser ? "本机只读服务使用独立配置，不载入旧版联系人、账号和推送密钥。" : "配置文件仍包含本机推送密钥和取货联系信息；请谨慎共享。长期历史与安全密钥存储会单独升级。"}</p><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(safeSettingsExport(ui.settings), null, 2)); feedback("已复制脱敏配置，不包含密钥和联系人"); } catch { feedback("复制失败，请检查剪贴板权限", true); } }}><ClipboardCopy />复制脱敏配置</Button><div className="scope-note"><Shield size={16} />复制内容只包含地区、监控目标及非敏感偏好，不包含 Bark、代理密钥或证件信息。</div></div></Panel></div>
  </>;
}
