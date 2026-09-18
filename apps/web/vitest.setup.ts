import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit rather than relying on Testing Library's afterEach auto-registration,
// which only self-wires when vitest's `globals` option is on — this project
// uses explicit `import { ... } from "vitest"` everywhere instead.
afterEach(cleanup);

// jsdom doesn't implement matchMedia — ThemeProvider (light/dark/system)
// depends on it, so tests need at least a no-op stand-in.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
