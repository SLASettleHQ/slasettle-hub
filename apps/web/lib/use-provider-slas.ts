"use client";

import { getBondBalance, getSla, getTokenDecimals, getTokenSymbol, type SLAConfig } from "@slasettle/sdk";
import { useCallback, useEffect, useState } from "react";
import { getProviderSlas } from "./indexer";

export interface ProviderSlaView {
  slaId: bigint;
  config: SLAConfig;
  bondBalance: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
}

interface State {
  slas: ProviderSlaView[];
  loading: boolean;
  error: string | null;
}

async function fetchProviderSlas(address: string): Promise<ProviderSlaView[]> {
  const { data: summaries } = await getProviderSlas(address);

  const tokenMetadataCache = new Map<string, { decimals: number; symbol: string }>();
  async function getTokenMetadata(token: string) {
    const cached = tokenMetadataCache.get(token);
    if (cached) return cached;
    const [decimals, symbol] = await Promise.all([getTokenDecimals(token), getTokenSymbol(token)]);
    const metadata = { decimals, symbol };
    tokenMetadataCache.set(token, metadata);
    return metadata;
  }

  return Promise.all(
    summaries.map(async (summary) => {
      const [config, bondBalance] = await Promise.all([
        getSla(summary.slaId),
        getBondBalance(summary.slaId),
      ]);
      const { decimals, symbol } = await getTokenMetadata(config.token);
      return {
        slaId: summary.slaId,
        config,
        bondBalance,
        tokenDecimals: decimals,
        tokenSymbol: symbol,
      };
    }),
  );
}

/**
 * Discovers a provider's SLA IDs via the indexer, then reads each one's
 * live config/balance (and its token's decimals/symbol) directly from
 * Soroban — the indexer only says which IDs exist, never live state.
 */
export function useProviderSlas(address: string | null) {
  const [state, setState] = useState<State>({ slas: [], loading: false, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!address) {
        if (!cancelled) setState({ slas: [], loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const slas = await fetchProviderSlas(address);
        if (!cancelled) setState({ slas, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({
            slas: [],
            loading: false,
            error: err instanceof Error ? err.message : "Failed to load your SLAs.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  return { ...state, refresh };
}
