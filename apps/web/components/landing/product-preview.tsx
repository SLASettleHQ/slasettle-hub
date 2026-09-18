import { QuorumMeter } from "@/components/status/quorum-meter";
import { SettlementList } from "@/components/status/settlement-list";
import { WatcherGrid } from "@/components/status/watcher-grid";

const EXAMPLE_WATCHERS = [
  { address: "GABC1EXAMPLEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAX1", status: "up" as const },
  { address: "GABC2EXAMPLEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAX2", status: "down" as const },
  { address: "GABC3EXAMPLEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAX3", status: "up" as const },
  { address: "GABC4EXAMPLEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAX4", status: "down" as const },
  { address: "GABC5EXAMPLEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAX5", status: "pending" as const },
];

const EXAMPLE_SETTLEMENT = {
  round: 118n,
  votesUp: 1,
  votesDown: 4,
  quorumThreshold: 3,
  penaltyAmount: 5_000_0000000n,
  tokenDecimals: 7,
  tokenSymbol: "USDC",
  transactionHash: "3f9a7c1e0d5b8a2f4c6e9d1b3a5f7c9e0d2b4a6f8c1e3d5b7a9f0c2e4d6b8a1f",
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/example",
};

export function ProductPreview() {
  return (
    <section aria-labelledby="preview-heading" className="py-16 sm:py-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="preview-heading"
          className="text-2xl font-semibold tracking-tight text-[var(--color-fg-primary)]"
        >
          The actual status page components
        </h2>
        <span className="rounded-full border border-[var(--color-border-default)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
          Example data &mdash; not a live SLA
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-[var(--color-fg-secondary)]">
        This is the same WatcherGrid, QuorumMeter, and SettlementList that render on every public
        status page &mdash; populated here with example values instead of a real SLA&apos;s state.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
            Watcher check-ins &mdash; round 118
          </h3>
          <div className="mt-3">
            <WatcherGrid watchers={EXAMPLE_WATCHERS} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
              Quorum
            </h3>
            <div className="mt-3">
              <QuorumMeter votesUp={1} votesDown={4} quorumThreshold={3} reached />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-fg-muted)]">
              Settlement history
            </h3>
            <div className="mt-1">
              <SettlementList settlements={[EXAMPLE_SETTLEMENT]} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
