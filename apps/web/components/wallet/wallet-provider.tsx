"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  connectWallet as connectFreighterWallet,
  getActiveWallet,
  isFreighterAvailable,
  WalletError,
  type WalletConnection,
} from "@/lib/wallet";

export type WalletStatus =
  | "checking"
  | "unavailable"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface WalletContextValue {
  status: WalletStatus;
  connection: WalletConnection | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("checking");
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingConnection() {
      const available = await isFreighterAvailable();
      if (cancelled) return;
      if (!available) {
        setStatus("unavailable");
        return;
      }

      try {
        const active = await getActiveWallet();
        if (cancelled) return;
        if (active) {
          setConnection(active);
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    }

    void checkExistingConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const result = await connectFreighterWallet();
      setConnection(result);
      setStatus("connected");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof WalletError
          ? err.message
          : "Freighter did not respond to the connection request.",
      );
    }
  }, []);

  const disconnect = useCallback(() => {
    // Freighter has no programmatic "revoke access" call — this only clears
    // this app's local session. The user can revoke site access from the
    // extension itself.
    setConnection(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ status, connection, error, connect, disconnect }),
    [status, connection, error, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider.");
  }
  return context;
}
