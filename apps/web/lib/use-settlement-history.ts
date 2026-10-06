"use client";

import { useCallback, useEffect, useState } from "react";
import { getSettlements, type IndexedSettlement } from "./indexer";
import { describeReadError } from "./read-error";

const PAGE_SIZE = 20;

interface State {
  settlements: IndexedSettlement[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

/** Cursor-paginated settlement history for an SLA, from the indexer. */
export function useSettlementHistory(slaId: bigint) {
  const [state, setState] = useState<State>({
    settlements: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const page = await getSettlements(slaId, { limit: PAGE_SIZE });
        if (!cancelled) {
          setState({
            settlements: page.data,
            nextCursor: page.nextCursor,
            loading: false,
            loadingMore: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            settlements: [],
            nextCursor: null,
            loading: false,
            loadingMore: false,
            error: describeReadError(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slaId]);

  const { nextCursor, loadingMore } = state;

  /**
   * Re-reads the newest page without clearing the list, so rows that were
   * already on screen stay mounted and only genuinely new rows appear.
   */
  const reload = useCallback(async () => {
    try {
      const page = await getSettlements(slaId, { limit: PAGE_SIZE });
      setState({
        settlements: page.data,
        nextCursor: page.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, error: describeReadError(err) }));
    }
  }, [slaId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setState((prev) => ({ ...prev, loadingMore: true }));

    try {
      const page = await getSettlements(slaId, { limit: PAGE_SIZE, before: nextCursor });
      setState((prev) => ({
        settlements: [...prev.settlements, ...page.data],
        nextCursor: page.nextCursor,
        loading: false,
        loadingMore: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loadingMore: false,
        error: describeReadError(err),
      }));
    }
  }, [slaId, nextCursor, loadingMore]);

  return { ...state, loadMore, reload };
}
