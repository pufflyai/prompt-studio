import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pstdio/ui/style.css";
import { DesktopLifecycleApp } from "./desktop-lifecycle-app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference="system">
      <ChakraProvider value={psTheme}>
        <DesktopLifecycleApp />
      </ChakraProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
