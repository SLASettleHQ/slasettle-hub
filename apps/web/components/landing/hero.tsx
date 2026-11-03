import Link from "next/link";
import { SlaLookupForm } from "./sla-lookup-form";

export function Hero() {
  return (
    <section className="grid gap-10 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
          Stellar / Soroban
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg-primary)] sm:text-5xl">
          Back an uptime promise with funds a contract actually holds.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--color-fg-secondary)]">
          A provider locks a bond in the <code className="font-mono text-[0.9em]">sla_vault</code>{" "}
          contract. Registered watchers check the service each round and vote{" "}
          <span className="font-mono text-[0.9em]">Up</span> or{" "}
          <span className="font-mono text-[0.9em]">Down</span>. When a round reaches quorum on{" "}
          <span className="font-mono text-[0.9em]">Down</span>, anyone can trigger settlement and
          the configured penalty is paid to the beneficiary.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            Open provider dashboard
          </Link>
        </div>

        <div className="mt-6 max-w-sm">
          <p className="mb-2 text-xs font-medium text-[var(--color-fg-muted)]">
            Have an SLA ID? Look up its public status:
          </p>
          <SlaLookupForm />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-[var(--shadow-raised)]">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
          What the contracts enforce
        </p>
        <ul className="mt-4 space-y-3 text-sm text-[var(--color-fg-secondary)]">
          <li className="flex gap-2">
            <span aria-hidden className="text-[var(--color-fg-muted)]">
              &rsaquo;
            </span><span>
            Quorum is checked <strong className="text-[var(--color-fg-primary)]">per round</strong>. Down
            votes are compared with the SLA&apos;s threshold; the contracts do not calculate a monthly uptime
            average.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-[var(--color-fg-muted)]">
              &rsaquo;
            </span><span>
            The configured uptime target is{" "}
            <strong className="text-[var(--color-fg-primary)]">descriptive metadata</strong>. The contracts
            do not calculate monthly uptime against it.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-[var(--color-fg-muted)]">
              &rsaquo;
            </span><span>
            The watcher registry is shared by all SLAs. A provider cannot select a separate watcher set for
            an SLA.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-[var(--color-fg-muted)]">
              &rsaquo;
            </span><span>
            <strong className="text-[var(--color-fg-primary)]">Any wallet</strong> can trigger settlement for
            a round after its Down votes reach quorum. The caller does not have to be the provider.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
