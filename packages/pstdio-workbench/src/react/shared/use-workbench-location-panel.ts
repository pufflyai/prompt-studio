import { getActiveWorkbenchLocationPanel, type WorkbenchCore, type WorkbenchPanelRegion } from "../../core";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useWorkbenchStore } from "./use-workbench-store";

/** Tabless page content is Main's location even though it lives outside the tab layout. */
export const useWorkbenchLocationPanel = (workbench: WorkbenchCore, panel: WorkbenchPanelRegion | undefined) => {
  const locationPanel = useWorkbenchStore(workbench.layout.store, (state) =>
    getActiveWorkbenchLocationPanel(state.layout),
  );
  const pageContent = useWorkbenchStore(workbench.pages.store, (state) =>
    panel === "main" ? resolvePageContent(state) : undefined,
  );
  return pageContent ?? locationPanel;
};
