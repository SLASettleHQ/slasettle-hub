/** Stable 32-byte endpoint commitment for Web fixtures and component tests. */
export const TEST_ENDPOINT_HASH = Uint8Array.from(
  { length: 32 },
  (_, index) => index + 1,
);
