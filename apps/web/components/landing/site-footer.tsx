import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Provider dashboard", external: false },
  {
    href: "https://github.com/SLASettleHQ/slasettle-vault",
    label: "Contract source",
    external: true,
  },
  {
    href: "https://github.com/SLASettleHQ/slasettle-hub",
    label: "Documentation",
    external: true,
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border-subtle)] py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-fg-muted)]">
          SLASettle &mdash; uptime bonds settled on Stellar.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--color-fg-secondary)] transition-colors hover:text-[var(--color-fg-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}
