import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("@/components/network/network-indicator", () => ({
  NetworkIndicator: () => <span>network indicator</span>,
}));

import { DesktopNav, MobileNav } from "./primary-nav";

beforeEach(() => {
  pathname.current = "/";
});

describe("DesktopNav", () => {
  it("links to the dashboard and the public SLA status lookup", () => {
    render(<DesktopNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(within(nav).getByRole("link", { name: "SLA status" })).toHaveAttribute("href", "/status");
  });

  it("marks the current page, including a nested status page", () => {
    pathname.current = "/status/42";
    render(<DesktopNav />);
    expect(screen.getByRole("link", { name: "SLA status" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileNav", () => {
  it("starts closed and exposes its state to assistive technology", () => {
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("opens a panel with every destination and the network indicator", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Menu" }));

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(within(nav).getByRole("link", { name: "SLA status" })).toHaveAttribute("href", "/status");
    expect(within(nav).getByText("network indicator")).toBeInTheDocument();
  });

  it("closes on Escape and on a second press", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "Menu" });

    await user.click(button);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    await user.click(button);
    await user.click(button);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("returns focus to the menu button when Escape closes the menu from inside it", async () => {
    const user = userEvent.setup();
    render(<MobileNav />);
    const button = screen.getByRole("button", { name: "Menu" });

    await user.click(button);
    await user.tab();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("closes itself when the page changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MobileNav />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    pathname.current = "/dashboard";
    rerender(<MobileNav />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
