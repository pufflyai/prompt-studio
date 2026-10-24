import type { WorkbenchCore } from "../../core";
import { pageForMainPlacement } from "../../core/controllers/page-location/main-placement-page";
import { resolvePageBreadcrumbPlacement } from "../../core/registries/pages/page-active-placement";
import { resolvePageContent } from "../../core/registries/pages/page-content";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useBreadcrumbPlacement = (workbench: WorkbenchCore) => {
  const state = useWorkbenchStore(workbench.pages.store, (state) => state);
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  const selected = useWorkbenchStore(workbench.layout.store, (state) =>
    resolvePageBreadcrumbPlacement(
      state.layout,
      page,
      workbench.pages.store.getState().location?.resource,
      (placement) => pageForMainPlacement(workbench, placement)?.id === page?.id,
    ),
  );
  const content = resolvePageContent(state);
  return { placement: content ?? selected, content };
};
