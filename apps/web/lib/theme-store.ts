import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

type Listener = () => void;

const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

/** Subscribes to both cross-tab storage events and same-tab preference writes. */
export function subscribeToPreference(listener: Listener): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getPreferenceSnapshot(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, blocked site data, etc).
  }
  return DEFAULT_THEME_PREFERENCE;
}

export function getPreferenceServerSnapshot(): ThemePreference {
  return DEFAULT_THEME_PREFERENCE;
}

/** Persists the preference and notifies same-tab subscribers immediately. */
export function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Persisting is a nice-to-have; the in-memory notify below still
    // updates the current tab even if storage is unavailable.
  }
  notify();
}

const lightSchemeQuery = "(prefers-color-scheme: light)";

export function subscribeToSystemScheme(listener: Listener): () => void {
  const media = window.matchMedia(lightSchemeQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function getSystemSchemeIsLightSnapshot(): boolean {
  return window.matchMedia(lightSchemeQuery).matches;
}

export function getSystemSchemeServerSnapshot(): boolean {
  return false;
}
