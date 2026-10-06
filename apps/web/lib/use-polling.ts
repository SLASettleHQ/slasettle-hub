"use client";

import { useCallback, useEffect, useState } from "react";

export interface PollingState<T> {
  data: T | null;
  /** Message from the latest failed attempt; cleared by the next success. Previous data is kept. */
  error: string | null;
  /** True only until the first attempt settles. */
  loading: boolean;
}

/**
 * Calls `fetcher` repeatedly, `intervalMs` after the previous call settles,
 * so requests never overlap and a slow backend is not hammered. It pauses
 * while the tab is hidden, fetches immediately when the tab becomes visible
 * again, and drops results that arrive after unmount or a restart.
 *
 * `fetcher` must be referentially stable (wrap it in `useCallback`); a new
 * function restarts polling. `refresh` restarts polling and fetches now.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true });
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (!cancelled) timer = setTimeout(() => void tick(), intervalMs);
    }

    async function tick() {
      if (cancelled || inFlight) return;
      if (document.hidden) {
        schedule();
        return;
      }
      inFlight = true;
      try {
        const data = await fetcher();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            data: prev.data,
            error: err instanceof Error ? err.message : "The request failed.",
            loading: false,
          }));
        }
      } finally {
        inFlight = false;
        schedule();
      }
    }

    function onVisibilityChange() {
      if (!document.hidden && !inFlight) {
        clearTimeout(timer);
        void tick();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetcher, intervalMs, restartKey]);

  const refresh = useCallback(() => setRestartKey((key) => key + 1), []);

  return { ...state, refresh };
}
