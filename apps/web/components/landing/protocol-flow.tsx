const STEPS = [
  {
    label: "Provider",
    detail: "Calls create_sla with a bond, penalty, and beneficiary.",
    chip: { text: "create_sla()", tone: "neutral" as const },
  },
  {
    label: "Funds locked",
    detail: "The bond sits in sla_vault until cancelled and withdrawn.",
    chip: { text: "1,000.00 USDC bonded", tone: "neutral" as const },
  },
  {
    label: "Watchers check in",
    detail: "The shared watcher set votes Up or Down each 60s round.",
    chip: { text: "4 of 5 checked in", tone: "pending" as const },
  },
  {
    label: "Round tally",
    detail: "watcher_registry counts votes for the current round.",
    chip: { text: "3 up · 2 down", tone: "neutral" as const },
  },
  {
    label: "Quorum",
    detail: "sla_vault compares the tally to quorum_threshold.",
    chip: { text: "Quorum reached", tone: "down" as const },
  },
  {
    label: "Settlement",
    detail: "Anyone calls trigger_settlement to pay the beneficiary.",
    chip: { text: "trigger_settlement()", tone: "neutral" as const },
  },
];

const CHIP_TONE_CLASSES: Record<string, string> = {
  neutral: "bg-[var(--color-status-neutral-bg)] text-[var(--color-status-neutral)]",
  pending: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending)]",
  down: "bg-[var(--color-status-down-bg)] text-[var(--color-status-down)]",
};

export function ProtocolFlow() {
  return (
    <section aria-labelledby="protocol-flow-heading" className="py-16 sm:py-20">
      <h2
        id="protocol-flow-heading"
        className="text-2xl font-semibold tracking-tight text-[var(--color-fg-primary)]"
      >
        How a round moves from bond to settlement
      </h2>
      <p className="mt-2 max-w-2xl text-[var(--color-fg-secondary)]">
        Every step below is a real state transition the contracts expose &mdash; this is the
        actual sequence, not a simplified pitch.
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-fg-muted)]">
        Example walkthrough &mdash; not live network data
      </span>

      <ol className="mt-10 grid gap-3 lg:grid-cols-6 lg:gap-0">
        {STEPS.map((step, index) => (
          <li key={step.label} className="relative flex lg:flex-col">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute left-4 top-9 hidden h-px w-full bg-[var(--color-border-default)] lg:block"
                style={{ left: "calc(50% + 1.1rem)", width: "calc(100% - 1.1rem)" }}
              />
            )}
            <div className="flex items-center gap-3 lg:flex-col lg:items-center lg:text-center">
              <span
                aria-hidden
                className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] font-mono text-xs text-[var(--color-fg-secondary)]"
              >
                {index + 1}
              </span>
              <div className="lg:mt-3">
                <h3 className="text-sm font-medium text-[var(--color-fg-primary)]">
                  {step.label}
                </h3>
              </div>
            </div>
            <div className="ml-11 mt-1 flex-1 pb-3 lg:ml-0 lg:mt-2 lg:px-2 lg:pb-0 lg:text-center">
              <p className="text-xs text-[var(--color-fg-secondary)]">{step.detail}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 font-mono text-[11px] ${CHIP_TONE_CLASSES[step.chip.tone]}`}
              >
                {step.chip.text}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
