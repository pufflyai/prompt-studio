import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { ResolvedOwnedPlacement } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { ownerLayoutActivation, resolveOwnerPlacements } from "./owner-layout-resolution";
import type { ConnectWorkbenchPageRuntimeInput } from "./page-runtime";
import { reuseSingleResourceWidgets } from "./page-widget-id";

const bindPlacementsToActivePageLocation = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
  const ownerResourceKey = resourceKey(state.location?.resource);
  if (!ownerResourceKey) return state.placements;
  return state.placements.map((placement) =>
    placement.value.role === "sub-panel" && (placement.identity.kind === "page" || Boolean(placement.value.resourceKey))
      ? { ...placement, value: { ...placement.value, ownerResourceKey } }
      : placement,
  );
};
export const prepareRuntimeLayout = (
  input: ConnectWorkbenchPageRuntimeInput,
  latest: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  activation: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>["placements"],
  enteringPage: boolean,
  liveLayout: WorkbenchLayout,
  previousModeId: string | undefined,
  adoptedModePlacements?: readonly ResolvedOwnedPlacement<WorkbenchWidgetPlacement>[],
) => {
  let modeLayout = latest.activeModeId ? input.loadModeLayout?.(latest.projectId, latest.activeModeId) : undefined;
  if (modeLayout && !enteringPage && latest.activeModeId === previousModeId) {
    // Membership comes from the saved mode owner. Within the same page, keep
    // live selection and geometry while batched persistence catches up.
    const regions = { ...modeLayout.regions };
    for (const region of Object.values(regions)) {
      const live = input.layout.getLayout().regions[region.id];
      regions[region.id] = {
        ...region,
        activeWidgetId: live.activeWidgetId,
        visible: live.visible,
        size: live.size,
        presentation: live.presentation,
      };
    }
    modeLayout = { ...modeLayout, regions };
  }
  const ownerManaged = Boolean(input.loadPageLayout && latest.activePageId);
  const placements =
    ownerManaged && input.loadPageLayout
      ? resolveOwnerPlacements({
          state: latest,
          pageLayout:
            enteringPage && !input.layout.enteredWithPersistedLayout() ? undefined : input.loadPageLayout(latest),
          modeLayout,
          enteringPage,
          currentLayout: input.layout.getLayout(),
          liveLayout,
          adoptedModePlacements,
          getWidget: input.layout.getWidget,
          hasDeclaration: input.hasDeclaration,
          existingEditor: input.existingEditor,
        })
      : bindPlacementsToActivePageLocation(latest);
  const located = placements.map((placement) => {
    if (placement.identity.kind !== "page" || !latest.location) return placement;
    const isMainResource =
      placement.identity.slotId === "$main" && placement.value.resourceKey === resourceKey(latest.location.resource);
    if (!isMainResource && placement.identity.slotId === "$main") return placement;
    return {
      ...placement,
      value: {
        ...placement.value,
        pageContext: { mode: latest.location.mode, parent: latest.location.parent },
        ...(isMainResource ? { section: latest.location.section, position: latest.location.position } : {}),
      },
    };
  });
  return {
    ownerManaged,
    layout: ownerManaged ? reuseSingleResourceWidgets(input.layout.getLayout(), placements) : input.layout.getLayout(),
    modeLayout,
    placements: located,
    activate: ownerLayoutActivation(activation, located).map((p) => p.identity),
  };
};
