import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { type WorkbenchWidgetPlacement, workbenchRegions } from "../../registries/layout/layout-types";
import { restoreOwnerRegion } from "../../registries/layout/owner-region-state";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
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
  const adopted: ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[] = [];
  for (const id of ["side", "secondary"] as const) {
    regions[id] = {
      ...regions[id],
      widgets: regions[id].widgets.map((placement, order) => {
        if (placement.placementIdentity || placement.role === "content") return placement;
        const value = {
          ...placement,
          placementIdentity: {
            kind: "mode" as const,
            modeId,
            placementId: placement.contributionId,
            instanceKey: placement.widgetId,
          },
        };
        adopted.push({ identity: value.placementIdentity, region: id, order, value });
        return value;
      }),
    };
  }
  if (adopted.length) layout.restoreLayout({ ...current, regions });
  return adopted;
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
      if (adopted.length && sameMode)
        input.cache.saveMode(state.projectId, state.activeModeId, input.layout.getLayout());
      // Carry adopted tabs into first composition without saving untouched
      // host geometry as authoritative incoming-mode choices.
      if (firstMode) return adopted;
    }
  }
};

export const createOwnerLayoutScopeHandler =
  (input: OwnerLayoutScopeHandlerInput) => (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
    const previous = input.getState() ?? state;
    if (!state.activePageId && previous.projectId === state.projectId) return;
    const adopted = saveOutgoingMode(input, state, previous);
    const firstModeGeometry = adopted ? input.layout.getLayout() : undefined;
    const scope = pageLayoutScope(
      { projectId: state.projectId, pageId: state.activePageId, resource: state.location?.resource },
      state.activePageId ? state.pages[state.activePageId] : undefined,
    );
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
    if (firstModeGeometry) {
      // Preserve shared geometry before composition. Newly declared panels can
      // still open an empty docked region; blank host state is not a mode cache.
      const layout = input.layout.getLayout();
      const regions = { ...layout.regions };
      for (const id of workbenchRegions) regions[id] = restoreOwnerRegion(layout, id, firstModeGeometry);
      input.layout.restoreLayout({ ...layout, regions });
    }
    return adopted;
  };
