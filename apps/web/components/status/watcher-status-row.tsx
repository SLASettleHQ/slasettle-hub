"use client";

import { useEffect, useRef, useState } from "react";
import { truncateAddress } from "@/lib/format";

export type WatcherCheckStatus = "up" | "down" | "pending";

const STATUS_LABEL: Record<WatcherCheckStatus, string> = {
  up: "Up",
  down: "Down",
  pending: "Pending",
};

const STATUS_CLASSES: Record<WatcherCheckStatus, string> = {
  up: "bg-[var(--color-status-up-bg)] text-[var(--color-status-up)]",
  down: "bg-[var(--color-status-down-bg)] text-[var(--color-status-down)]",
  pending: "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]",
};

const FLASH_COLOR_VAR: Record<WatcherCheckStatus, string> = {
  up: "var(--color-status-up)",
  down: "var(--color-status-down)",
  pending: "var(--color-status-neutral)",
};

export function WatcherStatusRow({
  address,
  status,
}: {
  address: string;
  status: WatcherCheckStatus;
}) {
  const previousStatus = useRef(status);
  const [justChanged, setJustChanged] = useState(false);

  // Flash only on a real transition observed after mount — never on the
  // initial render, which isn't a change, just the starting state.
  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    setJustChanged(true);
    const timeout = setTimeout(() => setJustChanged(false), 900);
    return () => clearTimeout(timeout);
  }, [status]);

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-md px-1.5 py-2 ${justChanged ? "animate-flash" : ""}`}
      style={justChanged ? ({ "--flash-color": FLASH_COLOR_VAR[status] } as React.CSSProperties) : undefined}
    >
      <span className="font-mono text-sm text-[var(--color-fg-secondary)]" title={address}>
        {truncateAddress(address)}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-300 ${STATUS_CLASSES[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
    </li>
  );
}
