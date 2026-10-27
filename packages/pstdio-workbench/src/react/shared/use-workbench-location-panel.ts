import { getActiveWorkbenchLocationPanel, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useWorkbenchStore } from "./use-workbench-store";

/** Tabless page content is Main's location even though it lives outside the tab layout. */
export const useWorkbenchLocationPanel = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion | undefined) => {
  const layout = useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const pageContent = useWorkbenchStore(workbench.pages.store, resolvePageContent);
  return (panel === "main" ? pageContent : undefined) ?? getActiveWorkbenchLocationPanel(layout);
};
