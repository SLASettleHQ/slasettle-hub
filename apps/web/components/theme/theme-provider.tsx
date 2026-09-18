"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { resolveTheme, type ResolvedTheme, type ThemePreference } from "@/lib/theme";
import {
  getPreferenceServerSnapshot,
  getPreferenceSnapshot,
  getSystemSchemeIsLightSnapshot,
  getSystemSchemeServerSnapshot,
  subscribeToPreference,
  subscribeToSystemScheme,
  writePreference,
} from "@/lib/theme-store";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreferenceSnapshot,
    getPreferenceServerSnapshot,
  );
  const systemIsLight = useSyncExternalStore(
    subscribeToSystemScheme,
    getSystemSchemeIsLightSnapshot,
    getSystemSchemeServerSnapshot,
  );

  const resolved: ResolvedTheme =
    preference === "system" ? (systemIsLight ? "light" : "dark") : resolveTheme(preference);

  // The blocking inline script in <head> already applied the correct
  // data-theme attribute before paint; this keeps it in sync with React
  // state afterward (e.g. when the preference or OS scheme changes).
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return context;
}
