import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pstdio/ui/style.css";
import { DesktopLifecycleApp } from "./desktop-lifecycle-app";

const initialState = await window.promptStudioDesktop.getStartupState();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference="system">
      <ChakraProvider value={psTheme}>
        <DesktopLifecycleApp initialState={initialState} />
      </ChakraProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
