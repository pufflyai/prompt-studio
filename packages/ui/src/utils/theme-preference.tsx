import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import {
  applyThemePreference,
  defaultThemePreferences,
  getThemePreferenceMode,
  isThemePreference,
  type ThemePreference,
  type ThemePreferenceMode,
  type ThemePreferenceOption,
} from "./apply-theme-preference";

const STORAGE_KEY = "theme-preference";

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  themePreferences: readonly ThemePreferenceOption[];
  setThemePreference: (preference: ThemePreference) => void;
  toggleThemePreference: () => void;
}

interface ThemePreferenceProviderProps {
  children: ReactNode;
  initialPreference?: ThemePreference;
  themePreferences?: readonly ThemePreferenceOption[];
}

const getDefaultThemePreference = (themePreferences: readonly ThemePreferenceOption[], mode: ThemePreferenceMode) =>
  themePreferences.find((preference) => preference.mode === mode)?.id ??
  themePreferences[0]?.id ??
  defaultThemePreferences[0].id;

export const getInitialThemePreference = (
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => {
  if (typeof window === "undefined") return getDefaultThemePreference(themePreferences, "light");

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isThemePreference(stored, themePreferences)) return stored;

  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return getDefaultThemePreference(themePreferences, prefersDark ? "dark" : "light");
};

export const ThemePreferenceProvider = (props: ThemePreferenceProviderProps) => {
  const { children, themePreferences = defaultThemePreferences } = props;
  const initialPreference = props.initialPreference ?? getInitialThemePreference(themePreferences);
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    applyThemePreference(themePreference, themePreferences);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, themePreference);
    }
  }, [themePreference, themePreferences]);

  const toggleThemePreference = () => {
    setThemePreference((prev) => {
      const nextMode = getThemePreferenceMode(prev, themePreferences) === "dark" ? "light" : "dark";

      return getDefaultThemePreference(themePreferences, nextMode);
    });
  };

  return (
    <ThemePreferenceContext value={{ themePreference, themePreferences, setThemePreference, toggleThemePreference }}>
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
