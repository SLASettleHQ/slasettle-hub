import Link from "next/link";
import { NetworkIndicator } from "@/components/network/network-indicator";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WalletButton } from "@/components/wallet/wallet-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg-base)]/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            >
              S
            </span>
            SLASettle
          </Link>
          <nav aria-label="Primary" className="hidden sm:block">
            <Link
              href="/dashboard"
              className="text-sm text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            >
              Dashboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NetworkIndicator />
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
