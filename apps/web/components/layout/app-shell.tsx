import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { SiteHeader } from "./site-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">{children}</main>
      </WalletProvider>
    </ThemeProvider>
  );
}
