"use client";

import { buildCreateSlaTx, getTokenDecimals, getTokenSymbol } from "@slasettle/sdk";
import { useState, type FormEvent } from "react";
import { FormField, inputClassName } from "@/components/form-field";
import { TransactionStatus } from "@/components/transaction-status";
import { InvalidTokenAmountError, parseTokenAmount } from "@/lib/format";
import { useTransaction } from "@/lib/use-transaction";
import { useWallet } from "@/components/wallet/wallet-provider";

interface FormValues {
  token: string;
  bondAmount: string;
  uptimeTargetPercent: string;
  quorumThreshold: string;
  penaltyPerBreach: string;
  beneficiary: string;
}

const EMPTY_VALUES: FormValues = {
  token: "",
  bondAmount: "",
  uptimeTargetPercent: "",
  quorumThreshold: "",
  penaltyPerBreach: "",
  beneficiary: "",
};

export function CreateSlaForm({ onCreated }: { onCreated?: () => void }) {
  const { connection } = useWallet();
  const { state, run, reset } = useTransaction();
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  const busy = state.status === "building" || state.status === "signing" || state.status === "submitting";

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return;
    reset();
    setFieldErrors({});

    const errors: Partial<Record<keyof FormValues, string>> = {};
    if (!values.token.trim()) errors.token = "Required.";
    if (!values.beneficiary.trim()) errors.beneficiary = "Required.";
    const quorum = Number(values.quorumThreshold);
    if (!Number.isInteger(quorum) || quorum <= 0) {
      errors.quorumThreshold = "Enter a whole number of watchers, e.g. 3.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const result = await run(async () => {
      let decimals: number;
      try {
        decimals = await getTokenDecimals(values.token.trim());
      } catch {
        throw new Error(
          `Could not read decimals() from token contract ${values.token.trim()}. Check the token contract ID.`,
        );
      }

      let bondAmount: bigint;
      let penaltyPerBreach: bigint;
      try {
        bondAmount = parseTokenAmount(values.bondAmount, decimals);
        penaltyPerBreach = parseTokenAmount(values.penaltyPerBreach, decimals);
      } catch (err) {
        throw err instanceof InvalidTokenAmountError ? err : new Error("Invalid amount.");
      }

      const symbol = await getTokenSymbol(values.token.trim()).catch(() => "tokens");
      if (penaltyPerBreach > bondAmount) {
        throw new Error(
          `Penalty per breach (${values.penaltyPerBreach} ${symbol}) cannot exceed the bond amount (${values.bondAmount} ${symbol}).`,
        );
      }

      const uptimeTargetBps = Number(parseTokenAmount(values.uptimeTargetPercent || "0", 2));

      return buildCreateSlaTx({
        provider: connection.address,
        token: values.token.trim(),
        bondAmount,
        uptimeTargetBps,
        quorumThreshold: quorum,
        penaltyPerBreach,
        beneficiary: values.beneficiary.trim(),
      });
    }, connection);

    if (result?.status === "SUCCESS") {
      setValues(EMPTY_VALUES);
      onCreated?.();
    }
  }

  if (!connection) {
    return (
      <p className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 text-sm text-[var(--color-fg-muted)]">
        Connect your wallet to create an SLA.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5"
    >
      <h3 className="text-sm font-semibold text-[var(--color-fg-primary)]">Create SLA</h3>

      <div className="mt-3 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-raised)] p-3 text-xs text-[var(--color-fg-secondary)]">
        <p>
          <strong className="text-[var(--color-fg-primary)]">Uptime target is display-only in v1.</strong>{" "}
          It is not computed as a monthly aggregate or enforced against real uptime — settlement fires
          per round when watchers reach quorum on Down, regardless of this number.
        </p>
        <p className="mt-1.5">
          <strong className="text-[var(--color-fg-primary)]">The watcher set is shared</strong> across
          every SLA on this deployment. You cannot curate your own trusted watchers in v1.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Token" help="The SEP-41 token contract (C...) the bond is denominated in." error={fieldErrors.token}>
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="C..."
              value={values.token}
              onChange={(e) => setField("token", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>

        <FormField
          label="Beneficiary"
          help="Address that receives the penalty payout when a breach is confirmed."
          error={fieldErrors.beneficiary}
        >
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="G..."
              value={values.beneficiary}
              onChange={(e) => setField("beneficiary", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>

        <FormField label="Bond amount" help="Locked into the vault when this SLA is created.">
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="1000.00"
              inputMode="decimal"
              value={values.bondAmount}
              onChange={(e) => setField("bondAmount", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>

        <FormField
          label="Penalty per breach"
          help="Fixed amount paid out each time a round is independently confirmed down by quorum."
        >
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="50.00"
              inputMode="decimal"
              value={values.penaltyPerBreach}
              onChange={(e) => setField("penaltyPerBreach", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>

        <FormField
          label="Quorum threshold"
          help="Minimum number of Down votes in a round required to confirm a breach."
          error={fieldErrors.quorumThreshold}
        >
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="3"
              inputMode="numeric"
              value={values.quorumThreshold}
              onChange={(e) => setField("quorumThreshold", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>

        <FormField label="Uptime target (%)" help="Display-only in v1 — see the note above.">
          {(props) => (
            <input
              {...props}
              className={inputClassName}
              placeholder="99.90"
              inputMode="decimal"
              value={values.uptimeTargetPercent}
              onChange={(e) => setField("uptimeTargetPercent", e.target.value)}
              disabled={busy}
            />
          )}
        </FormField>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Create SLA
        </button>
        <TransactionStatus state={state} />
      </div>
    </form>
  );
}
