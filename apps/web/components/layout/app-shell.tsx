import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <a
          href="#main"
          className="sr-only rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent-fg)] focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50"
        >
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 focus:outline-none sm:px-6">
          {children}
        </main>
      </WalletProvider>
    </ThemeProvider>
  );
}
