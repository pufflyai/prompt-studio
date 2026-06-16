import {
  ChakraProvider,
  type FileIconThemePreferenceOption,
  FileIconThemePreferenceProvider,
  psTheme,
  type ThemePreference,
  type ThemePreferenceOption,
  ThemePreferenceProvider,
} from "@pstdio/ui";
import { createContext, type ReactNode, useContext } from "react";

interface WorkbenchThemeProviderProps {
  children: ReactNode;
  initialThemePreference?: ThemePreference;
  themePreferences?: readonly ThemePreferenceOption[];
  fileIconThemePreferences?: readonly FileIconThemePreferenceOption[];
}

const WorkbenchThemeProviderContext = createContext(false);

export const WorkbenchThemeProvider = (props: WorkbenchThemeProviderProps) => {
  const { children, initialThemePreference, themePreferences, fileIconThemePreferences } = props;
  const hasWorkbenchThemeProvider = useContext(WorkbenchThemeProviderContext);

  if (hasWorkbenchThemeProvider) return children;

  return (
    <WorkbenchThemeProviderContext value>
      <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={themePreferences}>
        <FileIconThemePreferenceProvider themePreferences={fileIconThemePreferences}>
          <ChakraProvider value={psTheme}>{children}</ChakraProvider>
        </FileIconThemePreferenceProvider>
      </ThemePreferenceProvider>
    </WorkbenchThemeProviderContext>
  );
};
