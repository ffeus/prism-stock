import { useState } from "react";
import { BellRing, LoaderCircle, Volume2 } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { PageHeading, Panel, EmptyState, useFeedback } from "@/components/Workbench";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SecretInput } from "@/components/SecretInput";
import { saveSettings, testNotify } from "@/lib/store";
import { formatTime, type OpenOnHit } from "@/lib/types";
import { isInventoryBrowser } from "@/services/runtime";

export function NotificationsPage() {
  const ui = useWatcher(); const feedback = useFeedback(); const [draft, setDraft] = useState<string | null>(null); const [testing, setTesting] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const bark = draft ?? ui.settings.barkUrl;
  const saveBark = async () => { const value = bark.trim();
    try { if (value) { const url = new URL(value); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(); if (url.hostname === "api.day.app" && url.pathname.split("/").filter(Boolean).length !== 1) throw new Error(); } }
    catch { setError("请填写推送基础地址，例如 https://api.day.app/设备Key，不包含 curl 命令或标题正文。"); return; }
    setSaving(true); const ok = await saveSettings({ barkUrl: value }); setSaving(false); if (ok) { setDraft(null); setError(""); } feedback(ok ? "推送地址已保存" : "推送地址保存失败", !ok);
  };
  const save = async (patch: Parameters<typeof saveSettings>[0]) => { const ok = await saveSettings(patch); feedback(ok ? "提醒设置已保存" : "提醒设置保存失败", !ok); };
  if(isInventoryBrowser) return <><PageHeading title="通知中心" description="本轮先完成真实库存查询，尚未接通手机推送和声音渠道。" /><div className="scope-note">检测到有货会更新库存及本机会话记录，但不会发送 Bark、打开购物袋或执行结账。</div><Panel title="本机会话到货记录">{ui.session.notifications.length ? <div className="notification-list">{ui.session.notifications.slice().reverse().map(record=><article key={record.id}><div><strong>{record.title}</strong><p>{record.detail}</p><time>{formatTime(record.at)}</time></div></article>)}</div> : <EmptyState title="还没有到货事件" description="只显示实际库存查询产生的事件，不使用演示数据。" />}</Panel></>;
  return <><PageHeading title="通知中心" description="设置到货提醒与跳转方式，查看本次运行的触发记录。" actions={<Button variant="outline" disabled={testing || !ui.ready || draft !== null} onClick={async () => { setTesting(true); const ok = await testNotify(); setTesting(false); feedback(ok ? "测试请求已执行，请核对手机与声音提醒" : "测试提醒失败，请查看记录", !ok); }}>{testing ? <LoaderCircle className="animate-spin" /> : <BellRing />}测试提醒与跳转</Button>} />
    <div className="settings-grid"><Panel title="Bark 推送" description="通过手机上的 Bark 接收到货提醒"><div className="form-stack"><Label htmlFor="bark">默认推送地址</Label><SecretInput id="bark" value={bark} onChange={event => setDraft(event.target.value)} placeholder="https://api.day.app/你的设备Key" disabled={saving} /><p className="field-note">填入基础地址；同型号可在任务详情设置专属推送地址。保存后再发送测试提醒。</p>{error && <p className="inline-error" role="alert">{error}</p>}<Button className="self-start" variant="outline" disabled={saving || !ui.ready || draft === null} onClick={() => void saveBark()}>{saving ? "保存中" : "保存推送地址"}</Button></div></Panel>
      <Panel title="提醒规则" description="沿用当前引擎支持的到货行为"><div className="form-stack"><div className="setting-row"><Label htmlFor="sound-enabled"><Volume2 size={16} />播放提示音</Label><Switch id="sound-enabled" checked={ui.settings.soundEnabled} onCheckedChange={soundEnabled => void save({ soundEnabled })} /></div><div className="setting-row"><Label htmlFor="stop-on-hit">到货后暂停监控</Label><Switch id="stop-on-hit" checked={ui.settings.stopOnHit} onCheckedChange={stopOnHit => void save({ stopOnHit })} /></div><div className="field-group"><Label>到货后打开</Label><Select value={ui.settings.openOnHit} onValueChange={value => void save({ openOnHit: value as OpenOnHit })}><SelectTrigger aria-label="到货后打开"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">不自动打开</SelectItem><SelectItem value="product">商品详情页</SelectItem><SelectItem value="bag">购物袋</SelectItem><SelectItem value="education_bag">教育商店购物袋</SelectItem></SelectContent></Select></div><p className="field-note">{ui.settings.stopOnHit ? "任意目标有货后暂停本轮之后的监控，需要时手动恢复。" : "持续有货时，每轮仍会触发提醒。变化触发和提醒冷却将在后续版本提供。"}</p></div></Panel></div>
    <Panel title="提醒记录" description="当前会话 · 到货触发与手动测试，不代表手机送达回执">{ui.session.notifications.length ? <div className="notification-list">{ui.session.notifications.slice().reverse().map(record => <article key={record.id}><div className={`notification-dot ${record.kind}`}><BellRing size={17} /></div><div><strong>{record.title}</strong><p>{record.detail}</p><time>{formatTime(record.at)}</time></div><span className="section-badge">{record.kind === "triggered" ? "到货触发" : record.kind === "failed" ? "执行失败" : "测试已执行"}</span></article>)}</div> : <EmptyState title="还没有提醒记录" description="配置渠道并测试，或者等待监控检测到有货。" />}</Panel>
  </>;
}
