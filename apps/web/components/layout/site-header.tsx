import Link from "next/link";
import { NetworkIndicator } from "@/components/network/network-indicator";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { WalletButton } from "@/components/wallet/wallet-button";
import { DesktopNav, MobileNav } from "./primary-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg-base)]/75">
      <div className="relative mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md font-mono text-sm font-semibold tracking-tight text-[var(--color-fg-primary)]"
          >
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
            >
              S
            </span>
            <span className="hidden min-[400px]:inline">SLASettle</span>
            <span className="sr-only min-[400px]:hidden">SLASettle home</span>
          </Link>
          <DesktopNav />
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
          <div className="hidden sm:block">
            <NetworkIndicator />
          </div>
          <ThemeToggle />
          <WalletButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
