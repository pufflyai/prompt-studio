import {
  ChakraProvider,
  type FileIconThemePreferenceOption,
  FileIconThemePreferenceProvider,
  psTheme,
  type ThemePreference,
  type ThemePreferenceOption,
  ThemePreferenceProvider,
  type ThemePreferenceStorage,
  useUiScope,
} from "@pstdio/ui";
import { createContext, type ReactNode, useContext } from "react";

interface WorkbenchThemeProviderProps {
  children: ReactNode;
  initialThemePreference?: ThemePreference;
  defaultThemePreference?: ThemePreference;
  preferenceScope?: string;
  /** Where the chosen theme is saved. Defaults to browser storage. */
  themeStorage?: ThemePreferenceStorage;
  themePreferences?: readonly ThemePreferenceOption[];
  fileIconThemePreferences?: readonly FileIconThemePreferenceOption[];
}

const WorkbenchThemeProviderContext = createContext<{ initialThemePreference?: ThemePreference } | null>(null);

export const WorkbenchThemeProvider = (props: WorkbenchThemeProviderProps) => {
  const { children, initialThemePreference, themePreferences, fileIconThemePreferences } = props;
  const scope = useUiScope();
  const hasWorkbenchThemeProvider = useContext(WorkbenchThemeProviderContext);

  if (hasWorkbenchThemeProvider && !scope) return children;

  return (
    <WorkbenchThemeProviderContext value={{ initialThemePreference }}>
      <ThemePreferenceProvider
        initialPreference={initialThemePreference ?? hasWorkbenchThemeProvider?.initialThemePreference}
        defaultPreference={props.defaultThemePreference}
        preferenceScope={props.preferenceScope}
        storage={props.themeStorage}
        themePreferences={themePreferences}
      >
        <FileIconThemePreferenceProvider themePreferences={fileIconThemePreferences}>
          <ChakraProvider value={psTheme}>{children}</ChakraProvider>
        </FileIconThemePreferenceProvider>
      </ThemePreferenceProvider>
    </WorkbenchThemeProviderContext>
  );
};
