"use client";

import { getBondBalance, getSla, getTokenDecimals, getTokenSymbol, type SLAConfig } from "@slasettle/sdk";
import { useCallback, useEffect, useState } from "react";
import { getProviderSlas } from "./indexer";
import { describeReadError } from "./read-error";

export interface ProviderSlaView {
  slaId: bigint;
  config: SLAConfig;
  bondBalance: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
}

/** An SLA the indexer listed but whose live state could not be read. */
export interface ProviderSlaFailure {
  slaId: bigint;
  message: string;
}

export interface ProviderSlaResult {
  slas: ProviderSlaView[];
  failures: ProviderSlaFailure[];
}

interface State extends ProviderSlaResult {
  loading: boolean;
  /** Set when discovery itself failed, so it is never confused with "no SLAs". */
  error: string | null;
}

/** Soroban RPC is shared with the rest of the app; keep the fan-out modest. */
const MAX_CONCURRENT_SLA_READS = 4;

async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Discovers a provider's SLA IDs through the indexer, then reads each one's
 * live configuration, bond balance and token metadata directly from Soroban.
 * The indexer only says which IDs exist. A failure reading one SLA is
 * reported against that SLA and does not hide the others.
 */
export async function fetchProviderSlas(address: string): Promise<ProviderSlaResult> {
  const { data: summaries } = await getProviderSlas(address);

  const tokenMetadata = new Map<string, Promise<{ decimals: number; symbol: string }>>();
  function getTokenMetadata(token: string) {
    let pending = tokenMetadata.get(token);
    if (!pending) {
      pending = Promise.all([getTokenDecimals(token), getTokenSymbol(token)]).then(([decimals, symbol]) => ({
        decimals,
        symbol,
      }));
      tokenMetadata.set(token, pending);
    }
    return pending;
  }

  const outcomes = await mapWithLimit(
    summaries,
    MAX_CONCURRENT_SLA_READS,
    async (summary): Promise<{ sla: ProviderSlaView } | { failure: ProviderSlaFailure }> => {
      try {
        const [config, bondBalance] = await Promise.all([getSla(summary.slaId), getBondBalance(summary.slaId)]);
        const { decimals, symbol } = await getTokenMetadata(config.token);
        return {
          sla: { slaId: summary.slaId, config, bondBalance, tokenDecimals: decimals, tokenSymbol: symbol },
        };
      } catch (err) {
        return { failure: { slaId: summary.slaId, message: describeReadError(err) } };
      }
    },
  );

  const slas: ProviderSlaView[] = [];
  const failures: ProviderSlaFailure[] = [];
  for (const outcome of outcomes) {
    if ("sla" in outcome) slas.push(outcome.sla);
    else failures.push(outcome.failure);
  }
  return { slas, failures };
}

/** Provider SLAs for the connected wallet. `refresh` re-reads without clearing what is on screen. */
export function useProviderSlas(address: string | null) {
  const [state, setState] = useState<State>({ slas: [], failures: [], loading: false, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!address) {
        if (!cancelled) setState({ slas: [], failures: [], loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await fetchProviderSlas(address);
        if (!cancelled) setState({ ...result, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: describeReadError(err) }));
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
