import { nativeToScVal, type Transaction } from "@stellar/stellar-sdk";
import { buildInvokeTx, getSdkConfig, simulateReadCall } from "./client.js";
import type { RoundTally } from "./types.js";
import { assertAddress, assertU64 } from "./validate.js";

function decodeRoundTally(raw: unknown): RoundTally {
  if (typeof raw !== "object" || raw === null) {
    throw new TypeError("get_round_tally did not return a struct-shaped value.");
  }
  const record = raw as Record<string, unknown>;
  if (!("votes_up" in record) || !("votes_down" in record)) {
    throw new TypeError(
      "get_round_tally result is missing votes_up/votes_down. The deployed " +
        "watcher_registry contract may not match the SDK's expected shape.",
    );
  }
  const { votes_up: votesUp, votes_down: votesDown } = record;
  if (typeof votesUp !== "number" || typeof votesDown !== "number") {
    throw new TypeError(
      `get_round_tally votes_up/votes_down are ${typeof votesUp}/${typeof votesDown}, ` +
        "expected numbers (u32).",
    );
  }
  return { votesUp, votesDown };
}

/**
 * Reads a round's vote tally from `watcher_registry.get_round_tally`.
 * `endpointHash` is required in v0.2 — tallies are partitioned per
 * `(sla_id, round_id, endpoint_hash)`, so querying without it would silently
 * read the wrong (or an empty) tally.
 */
export async function getRoundTally(
  slaId: bigint,
  roundId: bigint,
  endpointHash: Uint8Array,
): Promise<RoundTally> {
  assertU64(slaId, "slaId");
  assertU64(roundId, "roundId");
  if (endpointHash.length !== 32) {
    throw new TypeError("getRoundTally: endpointHash must be exactly 32 bytes.");
  }
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "get_round_tally",
    [
      nativeToScVal(slaId, { type: "u64" }),
      nativeToScVal(roundId, { type: "u64" }),
      nativeToScVal(endpointHash, { type: "bytes" }),
    ],
  );
  return decodeRoundTally(result);
}

/** Reads whether a watcher has voted in a round from `watcher_registry.has_watcher_voted`. */
export async function hasWatcherVoted(
  slaId: bigint,
  roundId: bigint,
  watcher: string,
): Promise<boolean> {
  assertU64(slaId, "slaId");
  assertU64(roundId, "roundId");
  assertAddress(watcher, "watcher");
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "has_watcher_voted",
    [
      nativeToScVal(slaId, { type: "u64" }),
      nativeToScVal(roundId, { type: "u64" }),
      nativeToScVal(watcher, { type: "address" }),
    ],
  );
  if (typeof result !== "boolean") {
    throw new TypeError(
      `has_watcher_voted returned ${typeof result}, expected a boolean.`,
    );
  }
  return result;
}

/** Reads whether an address is an eligible watcher from `watcher_registry.is_watcher`. */
export async function isWatcher(watcher: string): Promise<boolean> {
  assertAddress(watcher, "watcher");
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "is_watcher",
    [nativeToScVal(watcher, { type: "address" })],
  );
  if (typeof result !== "boolean") {
    throw new TypeError(`is_watcher returned ${typeof result}, expected a boolean.`);
  }
  return result;
}

/**
 * Reads the contract's authoritative current round from
 * `watcher_registry.get_current_round`. Callers that need "the" current
 * round for a submission or a tally lookup should use this rather than
 * deriving it from `Date.now()` — the contract is the source of truth for
 * round freshness, and `submit_check` validates `round_id` against it.
 */
export async function getCurrentRound(): Promise<bigint> {
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "get_current_round",
    [],
  );
  if (typeof result !== "bigint") {
    throw new TypeError(
      `get_current_round returned ${typeof result}, expected a bigint (u64).`,
    );
  }
  return result;
}

/** Reads the eligible watcher count from `watcher_registry.get_watcher_count`. */
export async function getWatcherCount(): Promise<number> {
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "get_watcher_count",
    [],
  );
  if (typeof result !== "number") {
    throw new TypeError(
      `get_watcher_count returned ${typeof result}, expected a number (u32).`,
    );
  }
  return result;
}

/**
 * Builds an unsigned transaction that calls
 * `watcher_registry.extend_contract_ttl`. Public maintenance entrypoint: no
 * auth required by the contract, but still needs a funded `caller` account
 * to pay the transaction fee.
 */
export async function buildExtendWatcherRegistryTtlTx(caller: string): Promise<Transaction> {
  assertAddress(caller, "caller");
  const config = getSdkConfig();
  return buildInvokeTx(caller, config.watcherRegistryContractId, "extend_contract_ttl", []);
}
