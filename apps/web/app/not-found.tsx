import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <h1 className="text-xl font-semibold text-[var(--color-fg-primary)]">Page not found</h1>
      <p className="mt-3 text-[var(--color-fg-secondary)]">
        There is no page at this address. To check an SLA, look it up by its ID. To manage your own, open the
        dashboard.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/status"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90"
        >
          Look up an SLA
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-fg-primary)]"
        >
          Open dashboard
        </Link>
      </div>
    </div>
  );
}
