import {
  ChakraProvider,
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
}

const WorkbenchThemeProviderContext = createContext(false);

export const WorkbenchThemeProvider = (props: WorkbenchThemeProviderProps) => {
  const { children, initialThemePreference, themePreferences } = props;
  const hasWorkbenchThemeProvider = useContext(WorkbenchThemeProviderContext);

  if (hasWorkbenchThemeProvider) return children;

  return (
    <WorkbenchThemeProviderContext value>
      <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={themePreferences}>
        <ChakraProvider value={psTheme}>{children}</ChakraProvider>
      </ThemePreferenceProvider>
    </WorkbenchThemeProviderContext>
  );
};
