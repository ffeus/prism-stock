import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeMonitorStatus, describePickupDate, describeDelivery, type DeliveryTone } from "@/lib/monitorLog";
import type { Availability, PickupDetails, StatusTone } from "@/lib/types";

const TONE_CLASS: Record<StatusTone, string> = {
  inStock: "bg-in-stock/12 text-in-stock border-in-stock/25",
  outOfStock: "bg-out-of-stock/12 text-out-of-stock border-out-of-stock/30",
  presale: "bg-presale/12 text-presale border-presale/30",
  comingSoon: "bg-coming-soon/12 text-coming-soon border-coming-soon/30",
  pickupUnsupported: "bg-pickup-unsupported/12 text-pickup-unsupported border-pickup-unsupported/30",
  notForSale: "bg-not-for-sale/12 text-not-for-sale border-not-for-sale/30",
  unknown: "bg-unknown/12 text-unknown border-unknown/30",
  pending: "bg-transparent text-muted-foreground/70 border-border border-dashed",
};

const TONE_DOT: Record<StatusTone, string> = {
  inStock: "bg-in-stock shadow-[0_0_10px_var(--in-stock)]",
  outOfStock: "bg-out-of-stock",
  presale: "bg-presale",
  comingSoon: "bg-coming-soon",
  pickupUnsupported: "bg-pickup-unsupported",
  notForSale: "bg-not-for-sale",
  unknown: "bg-unknown",
  pending: "bg-muted-foreground/50",
};

export function StatusBadge({ availability, pickupDetails }: { availability: Availability; pickupDetails?: PickupDetails }) {
  const { label, tone, detail } = describeMonitorStatus({ availability, pickupDetails });
  const pickupDate = availability.kind === "in_stock" ? describePickupDate(pickupDetails?.pickupQuote) : null;
  const badge = (
    <span className="inline-flex flex-col items-center gap-0.5">
      <Badge
        variant="outline"
        className={`h-7 min-w-20 justify-center gap-2 px-2.5 font-medium ${TONE_CLASS[tone]}`}
      >
        <span className={`size-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
        {label}
      </Badge>
      {pickupDate ? <span className="text-[10px] leading-3 text-in-stock tabular-nums">{pickupDate} 可取</span> : null}
    </span>
  );
  if (!detail) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-90">{detail}</TooltipContent>
    </Tooltip>
  );
}

const DELIVERY_CLASS: Record<DeliveryTone, string> = {
  fast: "border-delivery-fast/30 bg-delivery-fast/12 text-delivery-fast",
  soon: "border-delivery-soon/30 bg-delivery-soon/12 text-delivery-soon",
  standard: "border-delivery-standard/30 bg-delivery-standard/12 text-delivery-standard",
  later: "border-delivery-later/35 bg-delivery-later/12 text-delivery-later",
  unavailable: "border-border bg-muted/35 text-muted-foreground",
  unknown: "border-delivery-unknown/30 bg-delivery-unknown/10 text-delivery-unknown",
};

export function DeliveryBadge({ pickupDetails, lastCheckedMs }: { pickupDetails?: PickupDetails; lastCheckedMs: number | null }) {
  const delivery = describeDelivery(pickupDetails, lastCheckedMs);
  if (!delivery) {
    return <span className="text-xs text-muted-foreground/60" title="Apple 本轮未返回预计送货时间">未返回</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-grid min-w-24 max-w-48 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 rounded-lg border px-2 py-1.5 ${DELIVERY_CLASS[delivery.tone]}`}
          aria-label={`预计送货：${delivery.detail}；${delivery.timing}`}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          <span className="whitespace-nowrap text-xs font-semibold tabular-nums">{delivery.label}</span>
          <span className="col-start-2 whitespace-normal text-[10px] leading-3 opacity-80">{delivery.timing}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-90">Apple 预计送货：{delivery.detail}</TooltipContent>
    </Tooltip>
  );
}
