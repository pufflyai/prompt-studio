import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import {
  applyThemePreference,
  applyThemePreferenceToElement,
  defaultThemePreferences,
  getThemePreferenceMode,
  isThemePreference,
  type ThemePreference,
  type ThemePreferenceMode,
  type ThemePreferenceOption,
} from "./apply-theme-preference";
import { createBrowserStorage } from "./browser-storage";
import { createPreferenceSurfaceOwner } from "./preference-surface-owner";
import { createThemePreferenceStore, getThemePreferenceStore } from "./theme-preference-store";

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
  /** The theme on screen: a preview while one is shown, otherwise the chosen theme. */
  themePreference: ThemePreference;
  /** The saved choice. It differs from `themePreference` only while a preview is shown. */
  chosenThemePreference: ThemePreference;
  /** The chosen theme while it waits for its contribution to register; `themePreference` shows a fallback until then. */
  pendingThemePreference: ThemePreference | null;
  themePreferences: readonly ThemePreferenceOption[];
  setThemePreference: (preference: ThemePreference) => void;
  /** Shows a theme without saving it. Pass `null` to return to the chosen theme. */
  previewThemePreference: (preference: ThemePreference | null) => void;
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
  const [explicitSelection] = useState(() =>
    props.initialPreference === undefined
      ? null
      : {
          storage,
          storageKey,
          store: createThemePreferenceStore(storage, storageKey, props.initialPreference),
        },
  );
  const sharedStore = getThemePreferenceStore(storage, storageKey, storage === browserStorage);
  const store =
    explicitSelection && explicitSelection.storage === storage && explicitSelection.storageKey === storageKey
      ? explicitSelection.store
      : sharedStore;
  const choice = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const themePreference = choice ?? props.defaultPreference ?? getInitialThemePreference(themePreferences, storage);
  const [preview, setPreview] = useState<ThemePreference | null>(null);
  const resolvedThemePreference = isThemePreference(themePreference, themePreferences)
    ? themePreference
    : getDefaultThemePreference(themePreferences, getThemePreferenceMode(themePreference, themePreferences));
  const shownPreview = preview && isThemePreference(preview, themePreferences) ? preview : null;
  // The provider shows a fallback while a chosen extension theme registers. The choice
  // stays in the selection on the first render and in storage after the fallback applies.
  const pendingThemePreference =
    looksLikeContributedThemePreference(themePreference) && !isThemePreference(themePreference, themePreferences)
      ? themePreference
      : null;

  useEffect(() => {
    if (isThemePreference(themePreference, themePreferences) && !props.defaultPreference)
      sharedStore.setChoice(themePreference);
  }, [sharedStore, themePreference, themePreferences, props.defaultPreference]);

  const setThemePreference = (preference: ThemePreference) => {
    store.update(preference);
    sharedStore.setChoice(preference);
    setPreview(null);
  };

  const toggleThemePreference = () => {
    const nextMode = getThemePreferenceMode(resolvedThemePreference, themePreferences) === "dark" ? "light" : "dark";

    setThemePreference(getDefaultThemePreference(themePreferences, nextMode));
  };

  return (
    <ThemePreferenceContext
      value={{
        themePreference: shownPreview ?? resolvedThemePreference,
        chosenThemePreference: resolvedThemePreference,
        pendingThemePreference,
        themePreferences,
        setThemePreference,
        previewThemePreference: setPreview,
        toggleThemePreference,
      }}
    >
      <themeSurfaces.Owner>
        <ThemePreferenceSurface>{children}</ThemePreferenceSurface>
      </themeSurfaces.Owner>
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

const themeSurfaces = createPreferenceSurfaceOwner();

/** Apply the owning preference to this surface; only an active surface owns document styling. */
export const ThemePreferenceSurface = (props: { children: ReactNode }) => {
  const { themePreference, themePreferences } = useThemePreference();
  const { scope, surfaces, count } = themeSurfaces.useSurface();
  useEffect(() => {
    if (scope?.root.current) applyThemePreferenceToElement(scope.root.current, themePreference, themePreferences);
    if (scope ? scope.active : count === 0 && !surfaces?.getSnapshot())
      applyThemePreference(themePreference, themePreferences);
  }, [themePreference, themePreferences, scope, surfaces, count]);
  return props.children;
};
