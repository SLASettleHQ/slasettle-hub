"use client";

import { buildTopUpBondTx } from "@slasettle/sdk";
import { useId, useState, type FormEvent } from "react";
import { TransactionStatus } from "@/components/transaction-status";
import { useWallet } from "@/components/wallet/wallet-provider";
import { inputClassName } from "@/components/form-field";
import { parseTokenAmount } from "@/lib/format";
import { useTransaction } from "@/lib/use-transaction";

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
  const [amount, setAmount] = useState("");
  const inputId = useId();

  const busy = state.status === "building" || state.status === "signing" || state.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connection) return;
    reset();

    const result = await run(async () => {
      let parsedAmount: bigint;
      try {
        parsedAmount = parseTokenAmount(amount, tokenDecimals);
      } catch (err) {
        throw err instanceof Error ? err : new Error("Invalid amount.");
      }
      return buildTopUpBondTx({ caller: connection.address, slaId, amount: parsedAmount });
    }, connection);

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
          className={`${inputClassName} mt-1 w-36`}
        />
      </div>
      <button
        type="submit"
        disabled={busy || !connection}
        className="rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-fg-primary)] transition-colors hover:border-[var(--color-border-strong)] disabled:opacity-60"
      >
        Top Up Bond
      </button>
      <TransactionStatus state={state} />
    </form>
  );
}
