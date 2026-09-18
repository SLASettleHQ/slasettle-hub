import { nativeToScVal } from "@stellar/stellar-sdk";
import { getSdkConfig, simulateReadCall } from "./client.js";
import type { RoundTally } from "./types.js";

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
  return {
    votesUp: record.votes_up as number,
    votesDown: record.votes_down as number,
  };
}

/** Reads a round's vote tally from `watcher_registry.get_round_tally`. */
export async function getRoundTally(
  slaId: bigint,
  roundId: bigint,
): Promise<RoundTally> {
  const config = getSdkConfig();
  const result = await simulateReadCall(
    config.watcherRegistryContractId,
    "get_round_tally",
    [nativeToScVal(slaId, { type: "u64" }), nativeToScVal(roundId, { type: "u64" })],
  );
  return decodeRoundTally(result);
}

/** Reads whether a watcher has voted in a round from `watcher_registry.has_watcher_voted`. */
export async function hasWatcherVoted(
  slaId: bigint,
  roundId: bigint,
  watcher: string,
): Promise<boolean> {
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
