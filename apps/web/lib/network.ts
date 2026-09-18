import { Networks } from "@stellar/stellar-sdk";

const KNOWN_NETWORK_LABELS: Record<string, string> = {
  [Networks.PUBLIC]: "Public Network",
  [Networks.TESTNET]: "Testnet",
  [Networks.FUTURENET]: "Futurenet",
  [Networks.SANDBOX]: "Sandbox",
  [Networks.STANDALONE]: "Standalone",
};

/** Maps a network passphrase to a short human label, or "Custom Network" for an unrecognized one. */
export function labelForNetworkPassphrase(passphrase: string): string {
  return KNOWN_NETWORK_LABELS[passphrase] ?? "Custom Network";
}

/** The network passphrase this deployment is configured for, or null if unset. */
export function getConfiguredNetworkPassphrase(): string | null {
  return process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? null;
}

const STELLAR_EXPERT_NETWORK_SLUGS: Record<string, string> = {
  [Networks.PUBLIC]: "public",
  [Networks.TESTNET]: "testnet",
};

/**
 * A stellar.expert explorer link for a transaction hash on this deployment's
 * configured network, or null when the network isn't one stellar.expert
 * indexes (e.g. a local/standalone network) — callers should fall back to
 * showing the raw hash without a link in that case.
 */
export function explorerTxUrl(transactionHash: string): string | null {
  const passphrase = getConfiguredNetworkPassphrase();
  const slug = passphrase ? STELLAR_EXPERT_NETWORK_SLUGS[passphrase] : undefined;
  return slug ? `https://stellar.expert/explorer/${slug}/tx/${transactionHash}` : null;
}
