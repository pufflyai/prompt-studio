import type { WorkbenchPanelMenuStateController } from "./controllers/panel-menus/panel-menu-state-controller";
import type { LayoutModel } from "./registries/layout/layout-model";
import type { WorkbenchWidgetPlacement } from "./registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "./registries/pages/page-registry";
import type { createWorkbenchInput } from "./workbench-core-types";

export const createPagePersistenceScopeHandler = (
  input: createWorkbenchInput,
  layout: Pick<LayoutModel, "getPersistenceScope" | "setPersistenceScope">,
  panelMenuState: WorkbenchPanelMenuStateController,
) => {
  const resolveScope = input.resolvePagePersistenceScope;
  if (!resolveScope) return undefined;
  return (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
    const resolved = resolveScope({
      currentScope: layout.getPersistenceScope(),
      modeId: state.activeModeId,
      pageId: state.activePageId,
      projectId: state.projectId,
      resource: state.location?.resource,
    });
    panelMenuState.setPersistenceScope(resolved.scope);
    layout.setPersistenceScope(resolved.scope, { carryRegionState: resolved.carryRegions });
  };
};
