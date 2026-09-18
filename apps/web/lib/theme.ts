export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "slasettle-theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return preference;
}

/**
 * Serialized as a blocking inline script in <head> so the resolved theme is
 * applied before first paint, avoiding a flash of the wrong theme. Must stay
 * dependency-free — it runs before any bundle loads.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var pref = stored === "dark" || stored === "light" || stored === "system"
      ? stored
      : "${DEFAULT_THEME_PREFERENCE}";
    var resolved = pref === "system"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : pref;
    document.documentElement.setAttribute("data-theme", resolved);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "${DEFAULT_THEME_PREFERENCE}");
  }
})();
`;
