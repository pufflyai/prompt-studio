import { defaultPageResourceCodec, type PageLocation } from "@pstdio/sdk/extensions";
import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { carryWorkbenchRegionState } from "../../registries/layout/layout-scope";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import { pageSlots } from "../../registries/pages/page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlotInstance,
} from "../../registries/pages/page-registry-types";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../../registries/placements/placement-instance-key";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { workbenchPageLocationsEqual } from "../page-location/page-location-normalization";

// The layout already persists instance resources, retention, and selection. Rebuild
// the page owner's state from that cache instead of storing a second copy.
export const pageStateFromLayout = (
  page: WorkbenchPageContribution,
  layout: WorkbenchLayout,
): WorkbenchPageRuntimeState => {
  const placements = Object.values(layout.regions).flatMap((region) => region.widgets);
  const openStaticSlotIds: string[] = [];
  const resourceInstances: Record<string, WorkbenchPageSlotInstance[]> = {};
  let activePrimaryInstanceKey: string | undefined;
  for (const slot of pageSlots(page)) {
    const matching = placements.filter(
      (placement) =>
        placement.placementIdentity?.kind === "page" &&
        placement.placementIdentity.pageId === page.id &&
        placement.placementIdentity.slotId === slot.id,
    );
    if (slot.item.kind === "view") {
      if (matching.length) openStaticSlotIds.push(slot.id);
      continue;
    }
    const binding = slot.item.binding;
    const instances = matching.flatMap((placement) => {
      const identity = placement.placementIdentity;
      if (!identity || !placement.resource || !resourceMatchesConstraint(binding, placement.resource)) return [];
      return [
        {
          instanceKey: binding.cardinality === "one" ? SINGLE_RESOURCE_INSTANCE_KEY : identity.instanceKey,
          resource: placement.resource,
          ...(placement.section ? { section: placement.section } : {}),
          ...(binding.cardinality === "many"
            ? { open: placement.tabRetention === "preview" ? ("preview" as const) : ("pin" as const) }
            : {}),
        },
      ];
    });
    resourceInstances[slot.id] = binding.cardinality === "one" ? instances.slice(-1) : instances;
    if (slot.role === "primary") {
      const active = matching.find((placement) => layout.activeLocationWidgetId === placement.widgetId);
      activePrimaryInstanceKey = active
        ? instances.find((instance) => instance.resource === active.resource)?.instanceKey
        : undefined;
    }
  }
  return { openStaticSlotIds, resourceInstances, activePrimaryInstanceKey };
};

export const loadWorkbenchLocationLayout = (
  input: createWorkbenchInput,
  context: WorkbenchPagePersistenceScopeInput,
  liveLayout?: Pick<LayoutModel, "getLayout" | "getPersistenceScope">,
) => {
  const resolved = input.resolvePagePersistenceScope?.({
    ...context,
    currentScope: liveLayout?.getPersistenceScope() ?? context.currentScope,
  });
  const saved =
    input.persistence?.getSnapshot(resolved?.scope)?.layout ?? input.layoutPersistence?.getLayout(resolved?.scope);
  if (!liveLayout || !resolved?.carryRegions?.length) return saved;
  return carryWorkbenchRegionState(
    liveLayout.getLayout(),
    saved ?? createDefaultWorkbenchLayout(),
    resolved.carryRegions,
  );
};

export const createPageStateRestorer =
  (input: createWorkbenchInput) => (page: WorkbenchPageContribution, location: PageLocation, projectId: string) => {
    const layout = loadWorkbenchLocationLayout(input, {
      modeId: page.modeId,
      pageId: page.id,
      projectId,
      resource: location.resource,
    });
    const saved = input.pageLocationPersistence?.load(projectId)?.location;
    const restoresSavedLocation = workbenchPageLocationsEqual(saved, location, defaultPageResourceCodec, [page]);
    if (
      !layout ||
      (!restoresSavedLocation &&
        !Object.values(layout.regions).some((region) =>
          region.widgets.some(
            (placement) =>
              placement.placementIdentity?.kind === "page" && placement.placementIdentity.pageId === page.id,
          ),
        ))
    )
      return undefined;
    return pageStateFromLayout(page, layout);
  };
