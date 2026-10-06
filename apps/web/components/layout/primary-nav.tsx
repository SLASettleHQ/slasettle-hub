"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { NetworkIndicator } from "@/components/network/network-indicator";

export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/status", label: "SLA status" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  "rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";

/** Inline links for screens that have room for them. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden sm:block">
      <ul className="flex items-center gap-5">
        {NAV_LINKS.map((link) => {
          const current = isCurrent(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`${linkBase} text-sm ${
                  current
                    ? "font-medium text-[var(--color-fg-primary)]"
                    : "text-[var(--color-fg-secondary)] hover:text-[var(--color-fg-primary)]"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The narrow-screen replacement for the inline links: a menu button that
 * opens a panel with the same destinations plus the network indicator, which
 * does not fit in the header at this width.
 */
export function MobileNav() {
  const pathname = usePathname();
  const panelId = useId();
  // Remember which page the menu was opened on, so navigating closes it
  // without an effect that sets state.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenOn(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenOn(open ? null : pathname)}
        className={`${linkBase} inline-flex h-9 items-center gap-2 border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-fg-primary)]`}
      >
        <span aria-hidden className="flex w-4 flex-col gap-[3px]">
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
        </span>
        Menu
      </button>
      {open && (
        <nav
          id={panelId}
          aria-label="Primary"
          className="animate-dropdown-in absolute inset-x-0 top-full z-20 border-b border-[var(--color-border-default)] bg-[var(--color-bg-raised)] px-4 py-3 shadow-[var(--shadow-raised)]"
        >
          <ul className="space-y-1">
            <li>
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className={`${linkBase} block px-2 py-3 text-base text-[var(--color-fg-primary)]`}
              >
                Overview
              </Link>
            </li>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(pathname, link.href) ? "page" : undefined}
                  className={`${linkBase} block px-2 py-3 text-base ${
                    isCurrent(pathname, link.href)
                      ? "font-medium text-[var(--color-fg-primary)]"
                      : "text-[var(--color-fg-secondary)]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-[var(--color-border-subtle)] pt-3">
            <NetworkIndicator />
          </div>
        </nav>
      )}
    </div>
  );
}
