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
