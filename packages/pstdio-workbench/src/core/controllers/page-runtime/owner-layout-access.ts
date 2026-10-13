import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
} from "../../registries/pages/page-registry-types";
import type { OwnedPlacementLocationContext } from "../../registries/placements/owned-placement-preparation";
import type { createWorkbenchInput } from "../../workbench-core-types";
import { pageLayoutScope } from "./owner-layout-scope";
import { loadWorkbenchLocationLayout } from "./page-state-restoration";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

export const createOwnerLayoutAccess = (
  input: createWorkbenchInput,
  cache: ReturnType<typeof createWorkbenchLayoutCache>,
  getPage: (id: string) => WorkbenchPageContribution | undefined,
) => ({
  resolveScope: (context: OwnedPlacementLocationContext) =>
    pageLayoutScope(
      { ...context, resource: context.location?.resource },
      context.pageId ? getPage(context.pageId) : undefined,
    ),
  loadLocation: (context: OwnedPlacementLocationContext) =>
    loadWorkbenchLocationLayout(
      input,
      { ...context, resource: context.location?.resource },
      context.pageId ? getPage(context.pageId) : undefined,
    ),
  loadPage: (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
    cache.layout.getLayout(
      pageLayoutScope(
        { projectId: state.projectId, pageId: state.activePageId, resource: state.location?.resource },
        state.activePageId ? state.pages[state.activePageId] : undefined,
      ),
    ),
});
