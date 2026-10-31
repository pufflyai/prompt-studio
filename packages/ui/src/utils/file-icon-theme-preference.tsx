import { createContext, type ReactNode, useContext, useEffect, useSyncExternalStore } from "react";
import {
  applyFileIconThemePreference,
  defaultFileIconThemePreferences,
  type FileIconThemePreferenceOption,
  isFileIconThemePreference,
} from "./apply-file-icon-theme-preference";
import { getFileIconPreferenceStore } from "./file-icon-preference-store";
import { createPreferenceSurfaceOwner } from "./preference-surface-owner";

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

const subscribeServer = () => () => {};
const emptyChoice = () => null;

export const FileIconThemePreferenceProvider = (props: FileIconThemePreferenceProviderProps) => {
  const { children, themePreferences = defaultFileIconThemePreferences } = props;
  const store = getFileIconPreferenceStore();
  const choice = useSyncExternalStore(
    store?.subscribe ?? subscribeServer,
    store?.getSnapshot ?? emptyChoice,
    emptyChoice,
  );
  const fileIconThemePreference = isFileIconThemePreference(choice, themePreferences)
    ? choice
    : getDefaultFileIconThemePreference(themePreferences);
  const activeFileIconTheme = themePreferences.find((theme) => theme.id === fileIconThemePreference);

  return (
    <FileIconThemePreferenceContext
      value={{
        fileIconThemePreference,
        fileIconThemePreferences: themePreferences,
        activeFileIconTheme,
        setFileIconThemePreference: (preference) => {
          store?.setChoice(preference);
        },
      }}
    >
      <iconSurfaces.Owner>
        <FileIconThemePreferenceSurface>{children}</FileIconThemePreferenceSurface>
      </iconSurfaces.Owner>
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

const iconSurfaces = createPreferenceSurfaceOwner();

export const FileIconThemePreferenceSurface = (props: { children: ReactNode }) => {
  const { fileIconThemePreference, fileIconThemePreferences } = useFileIconThemePreference();
  const { scope, surfaces, count } = iconSurfaces.useSurface();
  useEffect(() => {
    if (scope ? scope.active : count === 0 && !surfaces?.getSnapshot())
      applyFileIconThemePreference(fileIconThemePreference, fileIconThemePreferences);
  }, [fileIconThemePreference, fileIconThemePreferences, scope, surfaces, count]);
  return props.children;
};
