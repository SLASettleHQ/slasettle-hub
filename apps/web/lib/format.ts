/** Shortens a Stellar G.../C... address to e.g. "GABC…WXYZ" for display. */
export function truncateAddress(address: string, visible = 4): string {
  if (address.length <= visible * 2 + 1) {
    return address;
  }
  return `${address.slice(0, visible)}…${address.slice(-visible)}`;
}
