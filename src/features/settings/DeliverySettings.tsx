import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWatcher } from "@/hooks/useWatcher";
import { loadDeliveryLocalities, saveSettings } from "@/lib/store";
import type { DeliveryRegion, DeliveryLocalities } from "@/lib/types";
const EMPTY_DELIVERY_LOCALITIES: DeliveryLocalities = { states: [], cities: [], districts: [] };
export function DeliverySettings() {
  const ui = useWatcher();
  const [deliveryDraft, setDeliveryDraft] = useState<DeliveryRegion>({ state: "", city: "", district: "" });
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryLocalities>(EMPTY_DELIVERY_LOCALITIES);
  const [deliveryOptionsLoading, setDeliveryOptionsLoading] = useState(false);
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [deliveryDirty, setDeliveryDirty] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const deliveryRequestId = useRef(0);

  useEffect(() => {
    if (!ui.ready || deliveryDirty) return;
    setDeliveryDraft(ui.settings.deliveryRegion ?? { state: "", city: "", district: "" });
  }, [ui.ready, ui.settings.deliveryRegion, deliveryDirty]);

  useEffect(() => {
    if (!ui.ready || !deliveryRequested) return;
    const selected = ui.settings.deliveryRegion;
    const requestId = ++deliveryRequestId.current;
    setDeliveryOptionsLoading(true);
    void loadDeliveryLocalities(selected?.state, selected?.city)
      .then((options) => {
        if (deliveryRequestId.current !== requestId) return;
        setDeliveryOptions(options);
        if (selected && (
          !options.states.some((option) => option.value === selected.state)
          || !options.cities.some((option) => option.value === selected.city)
          || !options.districts.some((option) => option.value === selected.district)
        )) {
          setDeliveryDraft({ state: "", city: "", district: "" });
          setDeliveryDirty(true);
          setDeliveryError("此前保存的地址不是 Apple 官方选项，请重新选择。");
        } else {
          setDeliveryError(null);
        }
      })
      .catch((error) => {
        if (deliveryRequestId.current !== requestId) return;
        setDeliveryOptions(EMPTY_DELIVERY_LOCALITIES);
        setDeliveryError(`加载 Apple 地区选项失败：${String(error)}`);
      })
      .finally(() => {
        if (deliveryRequestId.current === requestId) setDeliveryOptionsLoading(false);
      });
  }, [ui.ready, ui.settings.deliveryRegion, deliveryRequested]);

  async function refreshDeliveryOptions(stateName: string, cityName = "") {
    const requestId = ++deliveryRequestId.current;
    setDeliveryOptionsLoading(true);
    setDeliveryError(null);
    try {
      const options = await loadDeliveryLocalities(stateName, cityName);
      if (deliveryRequestId.current === requestId) setDeliveryOptions(options);
    } catch (error) {
      if (deliveryRequestId.current === requestId) {
        setDeliveryError(`加载 Apple 地区选项失败：${String(error)}`);
      }
    } finally {
      if (deliveryRequestId.current === requestId) setDeliveryOptionsLoading(false);
    }
  }

  async function persistDeliveryRegion(region: DeliveryRegion) {
    setDeliverySaving(true);
    setDeliveryError(null);
    const saved = await saveSettings({ deliveryRegion: region });
    if (saved) {
      setDeliveryDirty(false);
    } else {
      setDeliveryError("送货地区保存失败，请重新选择区或稍后重试。");
    }
    setDeliverySaving(false);
  }


  const deliverySelectionValid = deliveryOptions.states.some(option => option.value === deliveryDraft.state) && deliveryOptions.cities.some(option => option.value === deliveryDraft.city) && deliveryOptions.districts.some(option => option.value === deliveryDraft.district);
  return (<div className="mt-3 field-group">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="control-label">
                      <MapPin className="size-3.5" aria-hidden="true" /> 中国大陆送货地区
                    </Label>
                    <span className="text-[10px] text-muted-foreground" role="status" aria-live="polite">
                      {deliverySaving
                        ? "保存中…"
                        : deliveryOptionsLoading
                        ? "读取官网…"
                        : deliveryDirty
                          ? deliverySelectionValid ? "即将保存" : "继续选择"
                          : ui.settings.deliveryRegion ? "已生效" : "未设置"}
                    </span>
                  </div>
                  {!deliveryRequested && <Button variant="outline" size="sm" disabled={!ui.ready} onClick={() => setDeliveryRequested(true)}>载入官网地区选项</Button>}
                  {!deliveryRequested && ui.settings.deliveryRegion && <p className="text-xs text-muted-foreground">已保存：{ui.settings.deliveryRegion.state} / {ui.settings.deliveryRegion.city} / {ui.settings.deliveryRegion.district}。修改时再载入。</p>}
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={deliveryOptions.states.some((option) => option.value === deliveryDraft.state) ? deliveryDraft.state : ""}
                      disabled={deliveryOptionsLoading || deliveryOptions.states.length === 0}
                      onValueChange={(value) => {
                        setDeliveryDirty(true);
                        setDeliveryError(null);
                        setDeliveryDraft({ state: value, city: "", district: "" });
                        void refreshDeliveryOptions(value);
                      }}
                    >
                      <SelectTrigger aria-label="省份" className="control-surface h-9 w-full min-w-0 px-2 text-xs">
                        <SelectValue placeholder="省份" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryOptions.states.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.text}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={deliveryOptions.cities.some((option) => option.value === deliveryDraft.city) ? deliveryDraft.city : ""}
                      disabled={deliveryOptionsLoading || !deliveryDraft.state || deliveryOptions.cities.length === 0}
                      onValueChange={(value) => {
                        setDeliveryDirty(true);
                        setDeliveryError(null);
                        setDeliveryDraft((previous) => ({ ...previous, city: value, district: "" }));
                        void refreshDeliveryOptions(deliveryDraft.state, value);
                      }}
                    >
                      <SelectTrigger aria-label="城市" className="control-surface h-9 w-full min-w-0 px-2 text-xs">
                        <SelectValue placeholder="城市" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryOptions.cities.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.text}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={deliveryOptions.districts.some((option) => option.value === deliveryDraft.district) ? deliveryDraft.district : ""}
                      disabled={deliveryOptionsLoading || !deliveryDraft.city || deliveryOptions.districts.length === 0}
                      onValueChange={(value) => {
                        const next = { ...deliveryDraft, district: value };
                        setDeliveryDirty(true);
                        setDeliveryError(null);
                        setDeliveryDraft(next);
                        void persistDeliveryRegion(next);
                      }}
                    >
                      <SelectTrigger aria-label="区" className="control-surface h-9 w-full min-w-0 px-2 text-xs">
                        <SelectValue placeholder="区" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryOptions.districts.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.text}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      与商品管理中的购买地区无关，仅用于中国大陆监控；选完“区”后自动保存。{ui.running ? "下轮会更新送货日期。" : "启动监控后会查询送货日期。"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 rounded-lg px-2 text-muted-foreground"
                      disabled={deliverySaving || (!ui.settings.deliveryRegion && !deliveryDirty)}
                      onClick={async () => {
                        setDeliverySaving(true);
                        const saved = await saveSettings({ deliveryRegion: null });
                        if (saved) {
                          setDeliveryDraft({ state: "", city: "", district: "" });
                          setDeliveryDirty(false);
                          setDeliveryError(null);
                        } else {
                          setDeliveryError("清除送货地区失败，请稍后重试。");
                        }
                        setDeliverySaving(false);
                      }}
                    >
                      清除
                    </Button>
                  </div>
                  {deliveryError ? (
                    <p role="alert" className="text-[11px] leading-4 text-destructive">{deliveryError}</p>
                  ) : null}
                </div>);
}
