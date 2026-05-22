import "@pstdio/ui/style.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
