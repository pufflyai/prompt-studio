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

/** The key, or key prefix for scoped choices, under which the provider saves the chosen theme. */
const themePreferenceStorageKey = "theme-preference";

/** Where the provider reads and saves the chosen theme. Defaults to browser storage. */
export interface ThemePreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

// A stable default keeps the provider effect from running on every render. It reads
// `localStorage` on each access because storage can be missing when this module loads.
const browserStorage: ThemePreferenceStorage = {
  getItem: (key) => createBrowserStorage().getItem(key),
  setItem: (key, value) => createBrowserStorage().setItem(key, value),
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

interface ThemePreferenceContextValue {
  themePreference: ThemePreference;
  /** The chosen theme while it waits for its contribution to register; `themePreference` shows a fallback until then. */
  pendingThemePreference: ThemePreference | null;
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
  storage?: ThemePreferenceStorage;
  themePreferences?: readonly ThemePreferenceOption[];
}

const getDefaultThemePreference = (themePreferences: readonly ThemePreferenceOption[], mode: ThemePreferenceMode) =>
  themePreferences.find((preference) => preference.mode === mode)?.id ??
  themePreferences[0]?.id ??
  defaultThemePreferences[0].id;

const getStoredThemePreference = (storage: ThemePreferenceStorage, storageKey: string) => {
  if (typeof window === "undefined") return null;

  return storage.getItem(storageKey);
};

const storeThemePreference = (storage: ThemePreferenceStorage, storageKey: string, preference: ThemePreference) => {
  if (typeof window === "undefined") return;

  storage.setItem(storageKey, preference);
};

// Contributed themes register asynchronously. Keep their stored preference until
// it registers or the user chooses another theme.
const looksLikeContributedThemePreference = (value: string | null) => typeof value === "string" && value.includes(".");

export const getInitialThemePreference = (
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
  storage: ThemePreferenceStorage = browserStorage,
) => {
  if (typeof window === "undefined") return getDefaultThemePreference(themePreferences, "light");

  const stored = getStoredThemePreference(storage, themePreferenceStorageKey);
  if (stored) return stored;

  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return getDefaultThemePreference(themePreferences, prefersDark ? "dark" : "light");
};

export const ThemePreferenceProvider = (props: ThemePreferenceProviderProps) => {
  const { children, storage = browserStorage, themePreferences = defaultThemePreferences } = props;
  const storageKey = props.preferenceScope
    ? `${themePreferenceStorageKey}:${props.preferenceScope}`
    : themePreferenceStorageKey;
  const storedPreference = props.initialPreference === undefined ? getStoredThemePreference(storage, storageKey) : null;
  const initialPreference =
    props.initialPreference ??
    storedPreference ??
    props.defaultPreference ??
    getInitialThemePreference(themePreferences, storage);
  const [selection, setSelection] = useState({ storageKey, preference: initialPreference });
  const themePreference = selection.storageKey === storageKey ? selection.preference : initialPreference;
  const resolvedThemePreference = isThemePreference(themePreference, themePreferences)
    ? themePreference
    : getDefaultThemePreference(themePreferences, getThemePreferenceMode(themePreference, themePreferences));
  const pendingThemePreference = resolvedThemePreference === themePreference ? null : themePreference;

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
    if (!hasPendingStoredTheme && !props.defaultPreference) storeThemePreference(storage, storageKey, themePreference);
  }, [
    resolvedThemePreference,
    storage,
    storedPreference,
    themePreference,
    themePreferences,
    storageKey,
    props.defaultPreference,
  ]);

  const setThemePreference = (preference: ThemePreference) => {
    storeThemePreference(storage, storageKey, preference);
    setSelection({ storageKey, preference });
  };

  const toggleThemePreference = () => {
    const nextMode = getThemePreferenceMode(resolvedThemePreference, themePreferences) === "dark" ? "light" : "dark";

    setThemePreference(getDefaultThemePreference(themePreferences, nextMode));
  };

  return (
    <ThemePreferenceContext
      value={{
        themePreference: resolvedThemePreference,
        pendingThemePreference,
        themePreferences,
        setThemePreference,
        toggleThemePreference,
      }}
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
