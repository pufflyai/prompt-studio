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
import { createBrowserStorage } from "./browser-storage";

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

const getStoredThemePreference = () => {
  if (typeof window === "undefined") return null;

  return createBrowserStorage().getItem(STORAGE_KEY);
};

const storeThemePreference = (preference: ThemePreference) => {
  if (typeof window === "undefined") return;

  createBrowserStorage().setItem(STORAGE_KEY, preference);
};

const isPendingStoredThemePreference = (input: {
  canRestoreStoredPreference: boolean;
  storedPreference: string | null;
  themePreference: ThemePreference;
  themePreferences: readonly ThemePreferenceOption[];
}) => {
  const { canRestoreStoredPreference, storedPreference, themePreference, themePreferences } = input;

  return (
    canRestoreStoredPreference &&
    storedPreference === themePreference &&
    !isThemePreference(themePreference, themePreferences)
  );
};

export const getInitialThemePreference = (
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => {
  if (typeof window === "undefined") return getDefaultThemePreference(themePreferences, "light");

  const stored = getStoredThemePreference();
  if (stored) return stored;

  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return getDefaultThemePreference(themePreferences, prefersDark ? "dark" : "light");
};

export const ThemePreferenceProvider = (props: ThemePreferenceProviderProps) => {
  const { children, themePreferences = defaultThemePreferences } = props;
  const initialPreference = props.initialPreference ?? getInitialThemePreference(themePreferences);
  const canRestoreStoredPreference = props.initialPreference === undefined;
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(initialPreference);
  const storedPreference = canRestoreStoredPreference ? getStoredThemePreference() : null;
  const pendingStoredPreference = isPendingStoredThemePreference({
    canRestoreStoredPreference,
    storedPreference,
    themePreference,
    themePreferences,
  });

  useEffect(() => {
    if (
      storedPreference &&
      storedPreference !== themePreference &&
      isThemePreference(storedPreference, themePreferences)
    ) {
      setThemePreferenceState(storedPreference);
      return;
    }

    if (pendingStoredPreference) {
      return;
    }

    if (!isThemePreference(themePreference, themePreferences)) {
      setThemePreferenceState(
        getDefaultThemePreference(themePreferences, getThemePreferenceMode(themePreference, themePreferences)),
      );
      return;
    }

    applyThemePreference(themePreference, themePreferences);
    const hasPendingStoredTheme =
      storedPreference &&
      storedPreference !== themePreference &&
      !isThemePreference(storedPreference, themePreferences);
    if (!hasPendingStoredTheme) storeThemePreference(themePreference);
  }, [pendingStoredPreference, storedPreference, themePreference, themePreferences]);

  const setThemePreference = (preference: ThemePreference) => {
    storeThemePreference(preference);
    setThemePreferenceState(preference);
  };

  const toggleThemePreference = () => {
    const nextMode = getThemePreferenceMode(themePreference, themePreferences) === "dark" ? "light" : "dark";

    setThemePreference(getDefaultThemePreference(themePreferences, nextMode));
  };

  if (pendingStoredPreference) return null;

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
