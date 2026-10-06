"use client";

import { useEffect, useRef, useState } from "react";
import { truncateAddress } from "@/lib/format";
import { useWallet } from "./wallet-provider";
import { WalletPanel } from "./wallet-panel";

export function WalletButton() {
  const { status, connection, error, connect } = useWallet();
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPanelOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  if (status === "unavailable") {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-[var(--color-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)]"
      >
        Install Freighter
      </a>
    );
  }

  if (status === "connected" && connection) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-1.5 font-mono text-sm text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-up)]" />
          {truncateAddress(connection.address)}
        </button>
        {panelOpen && <WalletPanel onClose={() => setPanelOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void connect()}
        disabled={status === "connecting" || status === "checking"}
        className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
      >
        {status === "connecting" ? "Connecting…" : "Connect Wallet"}
      </button>
      {status === "error" && error && (
        <span role="alert" className="max-w-56 text-right text-xs text-[var(--color-status-down)]">
          {error}
        </span>
      )}
    </div>
  );
}
