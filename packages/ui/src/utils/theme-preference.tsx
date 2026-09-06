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
  /** A default used only when the user has not chosen a theme in this scope. */
  defaultPreference?: ThemePreference;
  preferenceScope?: string;
  themePreferences?: readonly ThemePreferenceOption[];
}

const getDefaultThemePreference = (themePreferences: readonly ThemePreferenceOption[], mode: ThemePreferenceMode) =>
  themePreferences.find((preference) => preference.mode === mode)?.id ??
  themePreferences[0]?.id ??
  defaultThemePreferences[0].id;

const getStoredThemePreference = (storageKey = STORAGE_KEY) => {
  if (typeof window === "undefined") return null;

  return createBrowserStorage().getItem(storageKey);
};

const storeThemePreference = (preference: ThemePreference, storageKey = STORAGE_KEY) => {
  if (typeof window === "undefined") return;

  createBrowserStorage().setItem(storageKey, preference);
};

// Contributed themes register asynchronously. Keep their stored preference until
// it registers or the user chooses another theme.
const looksLikeContributedThemePreference = (value: string | null) => typeof value === "string" && value.includes(".");

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
  const storageKey = props.preferenceScope ? `${STORAGE_KEY}:${props.preferenceScope}` : STORAGE_KEY;
  const storedPreference = props.initialPreference === undefined ? getStoredThemePreference(storageKey) : null;
  const initialPreference =
    props.initialPreference ??
    storedPreference ??
    props.defaultPreference ??
    getInitialThemePreference(themePreferences);
  const [selection, setSelection] = useState({ storageKey, preference: initialPreference });
  const themePreference = selection.storageKey === storageKey ? selection.preference : initialPreference;
  const resolvedThemePreference = isThemePreference(themePreference, themePreferences)
    ? themePreference
    : getDefaultThemePreference(themePreferences, getThemePreferenceMode(themePreference, themePreferences));

  useEffect(() => {
    if (
      storedPreference &&
      storedPreference !== themePreference &&
      isThemePreference(storedPreference, themePreferences)
    ) {
      setSelection({ storageKey, preference: storedPreference });
      return;
    }

    if (!isThemePreference(themePreference, themePreferences)) {
      if (!props.defaultPreference) setSelection({ storageKey, preference: resolvedThemePreference });
      return;
    }

    applyThemePreference(themePreference, themePreferences);
    const hasPendingStoredTheme =
      storedPreference &&
      storedPreference !== themePreference &&
      looksLikeContributedThemePreference(storedPreference) &&
      !isThemePreference(storedPreference, themePreferences);
    if (!hasPendingStoredTheme && !props.defaultPreference) storeThemePreference(themePreference, storageKey);
  }, [
    resolvedThemePreference,
    storedPreference,
    themePreference,
    themePreferences,
    storageKey,
    props.defaultPreference,
  ]);

  const setThemePreference = (preference: ThemePreference) => {
    storeThemePreference(preference, storageKey);
    setSelection({ storageKey, preference });
  };

  const toggleThemePreference = () => {
    const nextMode = getThemePreferenceMode(resolvedThemePreference, themePreferences) === "dark" ? "light" : "dark";

    setThemePreference(getDefaultThemePreference(themePreferences, nextMode));
  };

  return (
    <ThemePreferenceContext
      value={{ themePreference: resolvedThemePreference, themePreferences, setThemePreference, toggleThemePreference }}
    >
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
