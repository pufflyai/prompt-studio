import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode } from "react";
import { initialDesktopState } from "../lifecycle/lifecycle-machine";
import { DesktopLifecycleApp } from "./desktop-lifecycle-app";

export const DesktopLifecycleRoot = (props: { platform: string }) => {
  const { platform } = props;
  return (
    <StrictMode>
      <ThemePreferenceProvider initialPreference="system">
        <ChakraProvider value={psTheme}>
          <DesktopLifecycleApp initialState={initialDesktopState} platform={platform} />
        </ChakraProvider>
      </ThemePreferenceProvider>
    </StrictMode>
  );
};
