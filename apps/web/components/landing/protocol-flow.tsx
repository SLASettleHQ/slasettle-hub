const STEPS = [
  {
    label: "Provider creates the SLA",
    detail: "The provider sets the token, bond, penalty per breach, quorum threshold and beneficiary, and funds the bond.",
    call: "sla_vault.create_sla",
  },
  {
    label: "Bond is held",
    detail: "The bond stays in the vault. The provider can top it up while the SLA is active.",
    call: "sla_vault.top_up_bond",
  },
  {
    label: "Watchers vote each round",
    detail: "Every 60 seconds each registered watcher checks the service once and votes Up or Down.",
    call: "watcher_registry.submit_check",
  },
  {
    label: "Votes are tallied",
    detail: "The registry counts the Up and Down votes for the round. It does not decide anything.",
    call: "watcher_registry.get_round_tally",
  },
  {
    label: "Quorum is checked",
    detail: "A round qualifies when its Down votes reach the SLA's quorum threshold. Up votes do not count toward it.",
    call: "votes_down \u2265 quorum_threshold",
  },
  {
    label: "Anyone settles",
    detail: "Once a round qualifies, any wallet can trigger settlement. The penalty is paid from the bond to the beneficiary.",
    call: "sla_vault.trigger_settlement",
  },
];

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
        Each step is a call or rule in the contracts. Nothing here is live network data. Open a status page to
        see a real SLA.
      </p>
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
              <h3 className="text-sm font-medium text-[var(--color-fg-primary)] lg:mt-3">{step.label}</h3>
            </div>
            <div className="ml-11 mt-1 flex-1 pb-3 lg:ml-0 lg:mt-2 lg:px-2 lg:pb-0 lg:text-center">
              <p className="text-xs text-[var(--color-fg-secondary)]">{step.detail}</p>
              <code className="mt-2 inline-block rounded bg-[var(--color-status-neutral-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-status-neutral)]">
                {step.call}
              </code>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
