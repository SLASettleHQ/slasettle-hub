import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/network/network-indicator", () => ({
  NetworkIndicator: () => <span>Testnet</span>,
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => (
    <div role="group" aria-label="Theme">
      <button type="button">Dark</button>
      <button type="button">Light</button>
      <button type="button">System</button>
    </div>
  ),
}));
vi.mock("@/components/wallet/wallet-button", () => ({
  WalletButton: () => <button type="button">Connect Wallet</button>,
}));

import { SiteHeader } from "./site-header";

describe("SiteHeader responsive layout", () => {
  it("lets the mobile controls wrap and keeps them accessible", () => {
    render(<SiteHeader />);

    const content = screen.getByRole("banner").firstElementChild;
    expect(content).toHaveClass("flex-wrap", "sm:flex-nowrap");
    expect(content?.lastElementChild).toHaveClass("w-full", "flex-wrap", "sm:flex-nowrap");
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Wallet" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
