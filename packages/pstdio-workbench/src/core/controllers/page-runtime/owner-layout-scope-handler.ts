import type { LayoutModel } from "../../registries/layout/layout-model-types";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchPanelMenuStateController } from "../panel-menus/panel-menu-state-controller";
import { pageLayoutScope } from "./owner-layout-scope";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

interface OwnerLayoutScopeHandlerInput {
  cache: ReturnType<typeof createWorkbenchLayoutCache>;
  layout: LayoutModel;
  menus: WorkbenchPanelMenuStateController;
  getState(): WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement> | undefined;
}

const adoptHostPanels = (layout: LayoutModel, modeId: string) => {
  const current = layout.getLayout();
  const regions = { ...current.regions };
  let changed = false;
  for (const id of ["side", "secondary"] as const) {
    regions[id] = {
      ...regions[id],
      widgets: regions[id].widgets.map((placement) => {
        if (placement.placementIdentity || placement.role === "content") return placement;
        changed = true;
        return {
          ...placement,
          placementIdentity: {
            kind: "mode" as const,
            modeId,
            placementId: placement.contributionId,
            instanceKey: placement.widgetId,
          },
        };
      }),
    };
  }
  if (changed) layout.restoreLayout({ ...current, regions });
  return changed;
};

const saveOutgoingMode = (
  input: OwnerLayoutScopeHandlerInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  previous: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  if (state.activeModeId && state.projectId === previous.projectId) {
    const sameMode = state.activeModeId === previous.activeModeId;
    const firstMode = !previous.activeModeId && !input.cache.readMode(state.projectId, state.activeModeId);
    if (sameMode || firstMode) {
      const adopted = adoptHostPanels(input.layout, state.activeModeId);
      if (firstMode || adopted) input.cache.saveMode(state.projectId, state.activeModeId, input.layout.getLayout());
    }
  }
};

export const createOwnerLayoutScopeHandler =
  (input: OwnerLayoutScopeHandlerInput) => (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
    const previous = input.getState() ?? state;
    if (!state.activePageId && previous.projectId === state.projectId) return;
    saveOutgoingMode(input, state, previous);
    const scope = pageLayoutScope({
      projectId: state.projectId,
      pageId: state.activePageId,
      resource: state.location?.resource,
    });
    const initialLayout =
      state.projectId &&
      !state.activePageId &&
      input.layout.getPersistenceScope() === undefined &&
      !input.cache.layout.getLayout(scope)
        ? input.layout.getLayout()
        : undefined;
    input.menus.setPersistenceScope(scope);
    input.layout.setPersistenceScope(scope);
    if (initialLayout) input.layout.restoreLayout(initialLayout);
  };
