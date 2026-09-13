import { ChakraProvider } from "@chakra-ui/react";
import { getInitialThemePreference, ThemePreferenceProvider } from "@pstdio/ui";
import "@pstdio/ui/style.css";
import type { ReactNode } from "react";
import { landingTheme } from "../theme/theme";

interface RootProviderProps {
  children: ReactNode;
}

export const RootProvider = (props: RootProviderProps) => {
  const { children } = props;

  return (
    <ChakraProvider value={landingTheme}>
      <ThemePreferenceProvider initialPreference={getInitialThemePreference()}>{children}</ThemePreferenceProvider>
    </ChakraProvider>
  );
};
