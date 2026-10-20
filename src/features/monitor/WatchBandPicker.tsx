import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { loadWatchBandChoices, loadWatchBandSizes, updateWatchBand } from "@/lib/store";
import type { Target, WatchBandChoice, WatchBandSize } from "@/lib/types";

function watchBandSizeLabel(text: string): string {
  return /^\d+$/.test(text.trim()) ? `${text.trim()} 号` : text.trim();
}

export function WatchBandPicker({
  target,
  defaultCompanionPart,
  disabled,
}: {
  target: Target;
  defaultCompanionPart?: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<WatchBandChoice[]>([]);
  const [sizes, setSizes] = useState<WatchBandSize[]>([]);
  const [choiceValue, setChoiceValue] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sizeRequest = useRef(0);

  const currentLabel = target.companionName
    ? target.companionName
    : `目录默认表带 ${target.companionPart ?? "未设置"}`;

  async function openPicker(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen || choices.length > 0 || loadingChoices) return;
    setLoadingChoices(true);
    setError(null);
    try {
      setChoices(await loadWatchBandChoices(target.locale, target.partNumber));
    } catch (reason) {
      setError(`读取 Apple 表带选项失败：${String(reason)}`);
    } finally {
      setLoadingChoices(false);
    }
  }

  async function chooseBand(value: string) {
    setChoiceValue(value);
    const request = ++sizeRequest.current;
    setSelectedPart("");
    setSizes([]);
    const choice = choices.find((item) => `${item.styleKey}::${item.colorKey}` === value);
    if (!choice) return;
    setLoadingSizes(true);
    setError(null);
    try {
      const nextSizes = await loadWatchBandSizes(
        target.locale,
        target.partNumber,
        choice.styleKey,
        choice.colorKey,
      );
      if (request !== sizeRequest.current) return;
      setSizes(nextSizes);
      const onlySize = nextSizes.length === 1 ? nextSizes.at(0) : undefined;
      if (onlySize) setSelectedPart(onlySize.partNumber);
    } catch (reason) {
      if (request === sizeRequest.current) setError(`读取 Apple 表带尺码失败：${String(reason)}`);
    } finally {
      if (request === sizeRequest.current) setLoadingSizes(false);
    }
  }

  async function applyBand() {
    const choice = choices.find((item) => `${item.styleKey}::${item.colorKey}` === choiceValue);
    const size = sizes.find((item) => item.partNumber === selectedPart);
    if (!choice || !size) return;
    setSaving(true);
    const companionName = `${choice.styleName} · ${choice.colorName} · ${watchBandSizeLabel(size.text)}`;
    const saved = await updateWatchBand(target, size.partNumber, companionName);
    setSaving(false);
    if (saved) setOpen(false);
    else setError("表带保存失败，未更改已保存的监控，请重试。");
  }

  async function restoreAutomaticBand() {
    if (!defaultCompanionPart) return;
    setSaving(true);
    const saved = await updateWatchBand(target, defaultCompanionPart);
    setSaving(false);
    if (saved) setOpen(false);
    else setError("恢复默认表带失败，请重试。");
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => void openPicker(nextOpen)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-0.5 block max-w-full truncate text-left text-[11px] leading-4 text-muted-foreground/75 hover:text-primary hover:underline"
          title={`${currentLabel}；点击按官网款式、颜色和尺码修改`}
          disabled={disabled}
        >
          送货表带：{currentLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[28rem] max-w-[calc(100vw-2rem)] space-y-4 rounded-xl">
        <PopoverHeader>
          <PopoverTitle>选择精确送货表带</PopoverTitle>
          <PopoverDescription className="leading-5">
            同一表壳在所有门店共用这条表带。送货日期取决于表壳、表带和尺码的完整组合。
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid gap-3">
          <div className="field-group">
            <Label className="control-label">款式与颜色</Label>
            <Select value={choiceValue} onValueChange={(value) => void chooseBand(value)} disabled={loadingChoices || saving}>
              <SelectTrigger className="control-surface w-full" aria-label="表带款式与颜色">
                <SelectValue placeholder={loadingChoices ? "正在读取 Apple 选项…" : "选择表带款式和颜色"} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((choice) => (
                  <SelectItem
                    key={`${choice.styleKey}::${choice.colorKey}`}
                    value={`${choice.styleKey}::${choice.colorKey}`}
                  >
                    {choice.styleName} · {choice.colorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field-group">
            <Label className="control-label">尺码</Label>
            <Select value={selectedPart} onValueChange={setSelectedPart} disabled={!choiceValue || loadingSizes || saving}>
              <SelectTrigger className="control-surface w-full" aria-label="表带尺码">
                <SelectValue placeholder={loadingSizes ? "正在读取 Apple 尺码…" : "选择尺码"} />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((size) => (
                  <SelectItem key={size.partNumber} value={size.partNumber}>
                    {watchBandSizeLabel(size.text)} · {size.partNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => void restoreAutomaticBand()} disabled={!defaultCompanionPart || saving}>
            恢复自动搭配
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>取消</Button>
            <Button size="sm" onClick={() => void applyBand()} disabled={!selectedPart || saving}>
              {saving ? "保存中…" : "应用到同型号"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
