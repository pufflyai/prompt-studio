import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LabPage } from "./views/lab-page";
import "./styles.css";

const mount = document.getElementById("root");
if (!mount) {
  throw new Error("Extension Lab webview is missing its #root mount element.");
}

createRoot(mount).render(
  <StrictMode>
    <LabPage />
  </StrictMode>,
);
