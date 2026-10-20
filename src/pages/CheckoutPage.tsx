import { ShieldCheck, Workflow } from "lucide-react";
import { useWatcher } from "@/hooks/useWatcher";
import { PageHeading } from "@/components/Workbench";
import { CheckoutSettings } from "@/components/CheckoutSettings";
import { isInventoryBrowser } from "@/services/runtime";

export function CheckoutPage() {
  const ui = useWatcher();
  if(isInventoryBrowser) return <><PageHeading title="自动结账" description="当前浏览器入口只提供真实库存查询。" /><div className="scope-note"><ShieldCheck size={18} />下单、付款、购物袋、登录及取货人信息均未接通；后端也会拒绝这些命令，不会因为有货而自动执行订单。</div></>;
  return <><PageHeading title="自动结账" description="先验证取货信息与购物袋，再决定是否启用到货后的结账辅助。" /><div className="checkout-overview"><span className="section-badge"><ShieldCheck size={14} />{ui.settings.checkout.placeOrder ? "允许提交真实订单" : "停在查看订单页"}</span><p>当前{ui.settings.checkout.enabled ? "已启用到货结账" : "未启用到货结账"}。付款始终由你完成。</p></div><div className="checkout-flow"><Workflow size={18} /><span>登录与购物袋</span><i>→</i><span>门店与取货信息</span><i>→</i><span>查看订单</span><i>→</i><span>人工确认</span></div><div className="settings-content"><CheckoutSettings checkout={ui.settings.checkout} targets={ui.settings.targets} expanded /></div></>;
}
