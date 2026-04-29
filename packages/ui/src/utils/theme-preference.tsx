import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import {
  applyThemePreference,
  getThemePreferenceMode,
  isThemePreference,
  type ThemePreference,
} from "./apply-theme-preference";

const STORAGE_KEY = "theme-preference";

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  toggleThemePreference: () => void;
}

interface ThemePreferenceProviderProps {
  children: ReactNode;
  initialPreference?: ThemePreference;
}

export const getInitialThemePreference = () => {
  if (typeof window === "undefined") return "pstdio-light";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemePreference(stored)) return stored;

  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return prefersDark ? "pstdio-dark" : "pstdio-light";
};

export const ThemePreferenceProvider = (props: ThemePreferenceProviderProps) => {
  const { children, initialPreference = getInitialThemePreference() } = props;
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    applyThemePreference(themePreference);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, themePreference);
    }
  }, [themePreference]);

  const toggleThemePreference = () =>
    setThemePreference((prev) => (getThemePreferenceMode(prev) === "dark" ? "pstdio-light" : "pstdio-dark"));

  return (
    <ThemePreferenceContext value={{ themePreference, setThemePreference, toggleThemePreference }}>
      {children}
    </ThemePreferenceContext>
  );
};

export const useThemePreference = () => {
  const context = useContext(ThemePreferenceContext);

  if (!context) {
    throw new Error("useThemePreference must be used within a ThemePreferenceProvider");
  }

  return context;
};
