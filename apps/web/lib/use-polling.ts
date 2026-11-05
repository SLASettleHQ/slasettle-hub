"use client";

import { useCallback, useEffect, useState } from "react";

export interface PollingState<T> {
  data: T | null;
  /** Message from the latest failed attempt; cleared by the next success. Previous data is kept. */
  error: string | null;
  /** True only until the first attempt settles. */
  loading: boolean;
}

interface PollingSnapshot<T> extends PollingState<T> {
  fetcher: () => Promise<T>;
}

/**
 * Calls `fetcher` immediately and then `intervalMs` after the previous call settles,
 * so requests never overlap and a slow backend is not hammered. After the
 * first load it pauses while the tab is hidden, fetches immediately when the tab becomes visible
 * again, and drops results that arrive after unmount or a restart. When disabled it makes no request
 * and exposes an empty loading state. Changing the fetcher invalidates data from its previous identity.
 *
 * `fetcher` must be referentially stable (wrap it in `useCallback`); a new
 * function restarts polling. `refresh` restarts polling and fetches now.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, enabled = true) {
  const [state, setState] = useState<PollingSnapshot<T>>({
    data: null,
    error: null,
    loading: true,
    fetcher,
  });
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, error: null, loading: true, fetcher });
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let hasFetched = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function schedule() {
      if (!cancelled) timer = setTimeout(() => void tick(), intervalMs);
    }

    async function tick() {
      if (cancelled || inFlight) return;
      // Hidden tabs skip refreshes, but never the first load: a page opened in
      // a background tab would otherwise sit in "loading" until it is focused.
      if (document.hidden && hasFetched) {
        schedule();
        return;
      }
      inFlight = true;
      hasFetched = true;
      try {
        const data = await fetcher();
        if (!cancelled) setState({ data, error: null, loading: false, fetcher });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            data: prev.fetcher === fetcher ? prev.data : null,
            error: err instanceof Error ? err.message : "The request failed.",
            loading: false,
            fetcher,
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
  }, [fetcher, intervalMs, restartKey, enabled]);

  const refresh = useCallback(() => setRestartKey((key) => key + 1), []);

  const visibleState: PollingState<T> =
    enabled && state.fetcher === fetcher ? state : { data: null, error: null, loading: true };

  return { ...visibleState, refresh };
}
