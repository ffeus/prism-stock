import { useSyncExternalStore } from "react";
import { watcherStore } from "@/lib/store";

export function useWatcher() {
  return useSyncExternalStore(watcherStore.subscribe, watcherStore.getSnapshot);
}
