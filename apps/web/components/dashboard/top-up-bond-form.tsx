"use client";

import { buildTopUpBondTx } from "@slasettle/sdk";
import { useId, useState, type FormEvent } from "react";
import { NetworkGuardNotice } from "@/components/network/network-guard-notice";
import { useNetworkGuard } from "@/components/network/use-network-guard";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { inputClassName } from "@/components/form-field";
import { parsePositiveAmount } from "@/lib/create-sla-validation";
import { isTransactionBusy, useTransaction } from "@/lib/use-transaction";

export function TopUpBondForm({
  slaId,
  tokenDecimals,
  tokenSymbol,
  onSuccess,
}: {
  slaId: bigint;
  tokenDecimals: number;
  tokenSymbol: string;
  onSuccess?: () => void;
}) {
  const { connection } = useWallet();
  const { state, run, reset } = useTransaction();
  const guard = useNetworkGuard();
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const busy = isTransactionBusy(state);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection || busy) return;
    reset();

    const parsed = parsePositiveAmount(amount, tokenDecimals, "top-up amount");
    if ("error" in parsed) {
      setAmountError(parsed.error);
      return;
    }
    setAmountError(null);

    const result = await run(
      () => buildTopUpBondTx({ caller: connection.address, slaId, amount: parsed.value }),
      connection,
    );

    // The displayed bond only changes when the parent refreshes it from the
    // contract after confirmation, never optimistically.
    if (result?.status === "SUCCESS") {
      setAmount("");
      onSuccess?.();
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={inputId} className="block text-xs font-medium text-[var(--color-fg-muted)]">
          Top up amount ({tokenSymbol})
        </label>
        <input
          id={inputId}
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          aria-invalid={amountError ? true : undefined}
          aria-describedby={amountError ? errorId : undefined}
          className={`${inputClassName} mt-1 w-36`}
        />
        {amountError && (
          <p id={errorId} role="alert" className="mt-1 max-w-xs text-xs text-[var(--color-status-down)]">
            {amountError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={busy || !connection || guard.blocked}
        className="rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-60"
      >
        Top Up Bond
      </button>
      <NetworkGuardNotice guard={guard} />
      <TransactionStatus state={state} />
    </form>
  );
}
