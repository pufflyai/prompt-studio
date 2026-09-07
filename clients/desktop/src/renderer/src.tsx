import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pstdio/ui/style.css";
import { DesktopLifecycleApp } from "./desktop-lifecycle-app";

const [initialState, appInfo] = await Promise.all([
  window.promptStudioDesktop.getStartupState(),
  window.promptStudioDesktop.getAppInfo(),
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference="system">
      <ChakraProvider value={psTheme}>
        <DesktopLifecycleApp initialState={initialState} platform={appInfo.platform} />
      </ChakraProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
