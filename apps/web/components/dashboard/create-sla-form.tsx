"use client";

import { buildCreateSlaTx, getTokenDecimals, getTokenSymbol } from "@slasettle/sdk";
import { useState, type FormEvent } from "react";
import { FormField, inputClassName } from "@/components/form-field";
import { TransactionStatus } from "@/components/transaction-status";
import {
  validateAmounts,
  validateStaticFields,
  type CreateSlaFieldErrors,
  type CreateSlaFormValues,
} from "@/lib/create-sla-validation";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";
import { useWallet } from "@/components/wallet/wallet-provider";

const EMPTY_VALUES: CreateSlaFormValues = {
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
  const guard = useNetworkGuard();
  const [values, setValues] = useState<CreateSlaFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<CreateSlaFieldErrors>({});
  const [checkingToken, setCheckingToken] = useState(false);

  const busy = isTransactionBusy(state) || checkingToken;

  function setField<K extends keyof CreateSlaFormValues>(key: K, value: CreateSlaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection || busy) return;
    reset();
    setFieldErrors({});

    const fields = validateStaticFields(values);
    if (Object.keys(fields.errors).length > 0) {
      setFieldErrors(fields.errors);
      return;
    }

    // The token's decimals decide how the amounts convert to base units, so
    // they are read live from the contract before the amounts can be checked.
    const token = values.token.trim();
    setCheckingToken(true);
    let decimals: number;
    let symbol: string;
    try {
      [decimals, symbol] = await Promise.all([getTokenDecimals(token), getTokenSymbol(token)]);
    } catch {
      setFieldErrors({
        token: "Could not read decimals() and symbol() from this contract. Check that it is a SEP-41 token on this network.",
      });
      return;
    } finally {
      setCheckingToken(false);
    }

    const amounts = validateAmounts(values, decimals, symbol);
    if (Object.keys(amounts.errors).length > 0) {
      setFieldErrors(amounts.errors);
      return;
    }

    const result = await run(
      () =>
        buildCreateSlaTx({
          provider: connection.address,
          token,
          bondAmount: amounts.bondAmount!,
          uptimeTargetBps: fields.uptimeTargetBps!,
          quorumThreshold: fields.quorumThreshold!,
          penaltyPerBreach: amounts.penaltyPerBreach!,
          beneficiary: values.beneficiary.trim(),
        }),
      connection,
    );

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
          <strong className="text-[var(--color-fg-primary)]">Uptime target is display information in v1.</strong>{" "}
          The contracts do not calculate monthly uptime against it. Settlement is decided per round, when
          enough watchers vote Down, whatever this number is.
        </p>
        <p className="mt-1.5">
          <strong className="text-[var(--color-fg-primary)]">The watcher set is shared.</strong> Every SLA on
          this deployment uses the same registered watchers. You cannot choose your own in v1.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Token" help="The SEP-41 token contract (C...) the bond is held in." error={fieldErrors.token}>
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
          help="Address that receives each penalty payment."
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

        <FormField
          label="Bond amount"
          help="Locked into the vault when this SLA is created. Enter it in whole token units, such as 1000.50."
          error={fieldErrors.bondAmount}
        >
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
          help="Fixed amount paid to the beneficiary each time a round settles. It cannot exceed the bond."
          error={fieldErrors.penaltyPerBreach}
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
          help="Number of Down votes, out of the shared watcher set, that a round needs before it can be settled."
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

        <FormField
          label="Uptime target (%)"
          help="Shown on the status page only. It does not drive settlement in v1."
          error={fieldErrors.uptimeTargetPercent}
        >
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
          disabled={busy || guard.blocked}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {checkingToken ? "Checking token…" : "Create SLA"}
        </button>
        <NetworkGuardNotice guard={guard} />
        <TransactionStatus state={state} />
      </div>
    </form>
  );
}
