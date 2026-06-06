import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={psTheme}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
