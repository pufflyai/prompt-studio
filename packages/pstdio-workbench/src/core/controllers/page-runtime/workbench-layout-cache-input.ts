import { canonicalRegistryId, historicalRegistryId } from "../../shared/contributions/identity-aliases";
import type { createWorkbenchInput, WorkbenchCore } from "../../workbench-core-types";
import { migratePagePanelView } from "./page-panel-view";
import { createWorkbenchLayoutCache } from "./workbench-layout-cache";

export const createCoreLayoutCache = (input: createWorkbenchInput, resolve: () => WorkbenchCore | undefined) =>
  createWorkbenchLayoutCache(
    input,
    () => resolve()?.pages.store.getState().activeModeId,
    (id) => resolve()?.layout.getWidget(id)?.tab,
    () => resolve()?.pages.listPages() ?? [],
    (page, widget, layout) => {
      const core = resolve();
      return migratePagePanelView(page, widget, core?.modePlacements, layout, core?.pages.resourceReferenceKey);
    },
    (modeId) =>
      new Set(
        resolve()
          ?.modePlacements.listPlacements(modeId)
          .map((placement) => placement.id) ?? [],
      ),
    (id) => {
      const store = resolve()?.pages.store;
      return store ? historicalRegistryId(store, id) : id;
    },
    (id) => {
      const store = resolve()?.pages.store;
      return store ? canonicalRegistryId(store, id) : id;
    },
  );
