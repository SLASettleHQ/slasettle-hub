import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePolling } from "./use-polling";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("loads once, then polls on the interval", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const { result } = renderHook(() => usePolling(fetcher, 1000));
    expect(result.current.loading).toBe(true);

    await act(async () => {});
    expect(result.current).toMatchObject({ data: "a", loading: false, error: null });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.data).toBe("b");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never overlaps requests: the next one waits for the previous to settle", async () => {
    let resolveFirst: (value: string) => void = () => {};
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue("later");
    renderHook(() => usePolling(fetcher, 1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst("first");
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good data when a later poll fails, and clears the error on recovery", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce("good")
      .mockRejectedValueOnce(new Error("indexer down"))
      .mockResolvedValueOnce("recovered");
    const { result } = renderHook(() => usePolling(fetcher, 1000));

    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toMatchObject({ data: "good", error: "indexer down" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toMatchObject({ data: "recovered", error: null });
  });

  it("does not fetch while the tab is hidden and fetches as soon as it is visible", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    renderHook(() => usePolling(fetcher, 1000));
    await act(async () => {});
    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => setHidden(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      setHidden(false);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("still performs the first load in a hidden tab, so the page does not sit in loading", async () => {
    setHidden(true);
    const fetcher = vi.fn().mockResolvedValue("first");
    const { result } = renderHook(() => usePolling(fetcher, 1000));
    await act(async () => {});
    expect(result.current).toMatchObject({ data: "first", loading: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops polling and ignores late results after unmount", async () => {
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = vi.fn().mockImplementation(() => new Promise<string>((resolve) => (resolveFetch = resolve)));
    const { unmount } = renderHook(() => usePolling(fetcher, 1000));

    unmount();
    await act(async () => {
      resolveFetch("late");
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refresh fetches again immediately", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const { result } = renderHook(() => usePolling(fetcher, 60_000));
    await act(async () => {});

    await act(async () => {
      result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
