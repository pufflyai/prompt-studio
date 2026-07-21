import { ChakraProvider } from "@chakra-ui/react";
import { getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import type { ReactNode } from "react";

interface RootProviderProps {
  children: ReactNode;
}

export const RootProvider = (props: RootProviderProps) => {
  const { children } = props;

  return (
    <ChakraProvider value={psTheme}>
      <ThemePreferenceProvider initialPreference={getInitialThemePreference()}>{children}</ThemePreferenceProvider>
    </ChakraProvider>
  );
};
