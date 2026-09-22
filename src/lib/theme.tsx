import { createContext, use, useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

/** Keep in sync with the pre-paint script in index.html. */
const STORAGE_KEY = "cadence-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Private mode and blocked site data both throw on access.
    return "system";
  }
}

function resolve(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

type ThemeState = {
  /** What the user chose, which may be "system". */
  theme: Theme;
  /** What that currently renders as. */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolve(readStoredTheme()),
  );

  // Apply on mount and on every change. The class may already be correct from
  // the pre-paint script; toggle() is idempotent, so this just keeps them
  // agreeing.
  useEffect(() => {
    const next = resolve(theme);
    document.documentElement.classList.toggle("dark", next === "dark");
    setResolved(next);
  }, [theme]);

  // Only follow the OS while the user has not picked a side.
  useEffect(() => {
    if (theme !== "system") return;

    const query = window.matchMedia(DARK_QUERY);
    const sync = () => {
      const next = query.matches ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      setResolved(next);
    };

    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting is survivable; the choice still applies this session.
    }
  }, []);

  return (
    <ThemeContext value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>.");
  }
  return context;
}
