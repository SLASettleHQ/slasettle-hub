"use client";

import type { ThemePreference } from "@/lib/theme";
import { useTheme } from "./theme-provider";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => setPreference(option.value)}
            className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)] ${
              active
                ? "bg-[var(--color-bg-raised)] text-[var(--color-fg-primary)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg-secondary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
