"use client";

import { getBondBalance, getSla, getTokenDecimals, getTokenSymbol, type SLAConfig } from "@slasettle/sdk";
import { useCallback, useEffect, useState } from "react";

export interface SlaConfigView {
  config: SLAConfig;
  bondBalance: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
}

interface State {
  data: SlaConfigView | null;
  loading: boolean;
  error: string | null;
}

async function fetchSlaConfig(slaId: bigint): Promise<SlaConfigView> {
  const [config, bondBalance] = await Promise.all([getSla(slaId), getBondBalance(slaId)]);
  const [tokenDecimals, tokenSymbol] = await Promise.all([
    getTokenDecimals(config.token),
    getTokenSymbol(config.token),
  ]);
  return { config, bondBalance, tokenDecimals, tokenSymbol };
}

/** Live SLA config, bond balance, and token metadata — all direct Soroban reads. */
export function useSlaConfig(slaId: bigint) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await fetchSlaConfig(slaId);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : `Failed to load SLA #${slaId}.`,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slaId, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return { ...state, refresh };
}
