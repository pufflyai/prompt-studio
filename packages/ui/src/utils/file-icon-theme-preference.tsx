import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import {
  applyFileIconThemePreference,
  defaultFileIconThemePreferences,
  type FileIconThemePreferenceOption,
  isFileIconThemePreference,
} from "./apply-file-icon-theme-preference";
import { createBrowserStorage } from "./browser-storage";

const STORAGE_KEY = "file-icon-theme-preference";

// The bundled Seti theme is the preferred default; fall back to whatever is registered first.
const getDefaultFileIconThemePreference = (themes: readonly FileIconThemePreferenceOption[]) =>
  themes.find((theme) => theme.id.endsWith(".seti"))?.id ?? themes[0]?.id ?? null;

interface FileIconThemePreferenceContextValue {
  fileIconThemePreference: string | null;
  fileIconThemePreferences: readonly FileIconThemePreferenceOption[];
  activeFileIconTheme: FileIconThemePreferenceOption | undefined;
  setFileIconThemePreference: (preference: string) => void;
}

const FileIconThemePreferenceContext = createContext<FileIconThemePreferenceContextValue | null>(null);

interface FileIconThemePreferenceProviderProps {
  children: ReactNode;
  themePreferences?: readonly FileIconThemePreferenceOption[];
}

const getInitialPreference = (themes: readonly FileIconThemePreferenceOption[]) => {
  if (typeof window === "undefined") return getDefaultFileIconThemePreference(themes);

  const stored = createBrowserStorage().getItem(STORAGE_KEY);
  if (isFileIconThemePreference(stored, themes)) return stored;

  return getDefaultFileIconThemePreference(themes);
};

export const FileIconThemePreferenceProvider = (props: FileIconThemePreferenceProviderProps) => {
  const { children, themePreferences = defaultFileIconThemePreferences } = props;
  const [fileIconThemePreference, setFileIconThemePreference] = useState<string | null>(() =>
    getInitialPreference(themePreferences),
  );

  useEffect(() => {
    const resolved = isFileIconThemePreference(fileIconThemePreference, themePreferences)
      ? fileIconThemePreference
      : getDefaultFileIconThemePreference(themePreferences);

    if (resolved !== fileIconThemePreference) {
      setFileIconThemePreference(resolved);
      return;
    }

    applyFileIconThemePreference(resolved, themePreferences);
    if (typeof window !== "undefined" && resolved) createBrowserStorage().setItem(STORAGE_KEY, resolved);
  }, [fileIconThemePreference, themePreferences]);

  const activeFileIconTheme = themePreferences.find((theme) => theme.id === fileIconThemePreference);

  return (
    <FileIconThemePreferenceContext
      value={{
        fileIconThemePreference,
        fileIconThemePreferences: themePreferences,
        activeFileIconTheme,
        setFileIconThemePreference,
      }}
    >
      {children}
    </FileIconThemePreferenceContext>
  );
};

export const useFileIconThemePreference = () => {
  const context = useContext(FileIconThemePreferenceContext);

  if (!context) {
    throw new Error("useFileIconThemePreference must be used within a FileIconThemePreferenceProvider");
  }

  return context;
};
