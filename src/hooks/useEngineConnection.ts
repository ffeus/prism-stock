import { useCallback, useEffect, useState } from "react";
import { connect } from "@/lib/store";

export function useEngineConnection() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const retry = useCallback(async () => {
    setBusy(true); setError(null);
    try { await connect(); setConnected(true); } catch (reason) { setConnected(false); setError(String(reason)); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void retry(); }, [retry]);
  return { error, busy, connected, retry };
}
