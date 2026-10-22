import type { PageLocation, ResourceRef } from "@pstdio/sdk/extensions";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { carryWorkbenchRegionState } from "../../registries/layout/layout-scope";
import { createDefaultWorkbenchLayout, type WorkbenchLayout } from "../../registries/layout/layout-types";
import { PAGE_MAIN_SLOT_ID, pageSlots } from "../../registries/pages/page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlotInstance,
} from "../../registries/pages/page-registry-types";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../../registries/placements/placement-instance-key";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";
import { workbenchPageLocationsEqual } from "../page-location/page-location-normalization";

// The layout already persists instance resources, retention, and selection. Rebuild
// the page owner's state from that cache instead of storing a second copy.
export const pageStateFromLayout = (
  page: WorkbenchPageContribution,
  layout: WorkbenchLayout,
  resource: ResourceRef | undefined,
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
      if (
        matching.some(
          (placement) => pageResourceContextKey(page, placement.resource) === pageResourceContextKey(page, resource),
        )
      ) {
        openStaticSlotIds.push(slot.id);
        if (slot.role === "primary") activePrimaryInstanceKey = matching[0]?.placementIdentity?.instanceKey;
      }
      continue;
    }
    const binding = slot.item.binding;
    const current =
      slot.role === "primary" && binding.cardinality === "one"
        ? matching.filter(
            (placement) => pageResourceContextKey(page, placement.resource) === pageResourceContextKey(page, resource),
          )
        : matching;
    const instances = current.flatMap((placement) => {
      const identity = placement.placementIdentity;
      if (!identity || !placement.resource || !resourceMatchesConstraint(binding, placement.resource)) return [];
      return [
        {
          instanceKey:
            binding.cardinality === "one" && slot.role !== "primary"
              ? SINGLE_RESOURCE_INSTANCE_KEY
              : identity.instanceKey,
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
      const active = current.find((placement) => layout.activeLocationWidgetId === placement.widgetId);
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

const pagePrimaryStateLayout = (
  pageLayout: WorkbenchLayout | undefined,
  modeLayout: WorkbenchLayout | undefined,
  page: WorkbenchPageContribution,
) => {
  if (!modeLayout || page.main.kind !== "view") return pageLayout;
  const base = pageLayout ?? createDefaultWorkbenchLayout();
  const regions = { ...base.regions };
  // Moved primaries still own the route. Auxiliary tabs restore through their mode's lifetime.
  for (const region of ["side", "secondary"] as const) {
    regions[region] = {
      ...modeLayout.regions[region],
      widgets: modeLayout.regions[region].widgets.filter(
        (placement) =>
          placement.placementIdentity?.kind === "page" &&
          placement.placementIdentity.pageId === page.id &&
          placement.placementIdentity.slotId === PAGE_MAIN_SLOT_ID,
      ),
    };
  }
  return { ...base, regions, activeLocationWidgetId: modeLayout.activeLocationWidgetId ?? base.activeLocationWidgetId };
};

export const createPageStateRestorer =
  (
    input: createWorkbenchInput,
    loadLayout: (
      context: WorkbenchPagePersistenceScopeInput,
      page: WorkbenchPageContribution,
    ) => WorkbenchLayout | undefined = (context) => loadWorkbenchLocationLayout(input, context),
    loadModeLayout?: (projectId: string, modeId: string) => WorkbenchLayout | undefined,
    hasPageMain?: (context: WorkbenchPagePersistenceScopeInput, page: WorkbenchPageContribution) => boolean,
  ) =>
  (page: WorkbenchPageContribution, location: PageLocation, projectId: string) => {
    const context = { modeId: page.modeId, pageId: page.id, projectId, resource: location.resource };
    const pageLayout = loadLayout(context, page);
    const modeLayout = loadModeLayout?.(projectId, page.modeId);
    const layout = pagePrimaryStateLayout(pageLayout, modeLayout, page);
    // Shared geometry contains an empty Main region even when this page has no
    // saved override. Only an actual Main snapshot can persist a closed tab.
    if (hasPageMain && !hasPageMain(context, page)) return undefined;
    const saved = input.pageLocationPersistence?.load(projectId)?.location;
    const restoresSavedLocation = workbenchPageLocationsEqual(saved, location, defaultPageResourceCodec, [page]);
    if (
      !layout ||
      (!restoresSavedLocation &&
        !Object.values(layout.regions).some((region) =>
          region.widgets.some(
            (placement) =>
              placement.placementIdentity?.kind === "page" &&
              placement.placementIdentity.pageId === page.id &&
              (page.main.kind === "panels" ||
                pageResourceContextKey(page, placement.resource) === pageResourceContextKey(page, location.resource)),
          ),
        ))
    )
      return undefined;
    return pageStateFromLayout(page, layout, location.resource);
  };
