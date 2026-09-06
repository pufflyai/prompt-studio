import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { pageSlots } from "../../registries/pages/page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlotInstance,
} from "../../registries/pages/page-registry-types";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { createWorkbenchInput, WorkbenchPagePersistenceScopeInput } from "../../workbench-core-types";

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
          instanceKey: identity.instanceKey,
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
      const active = matching.find((placement) => layout.regions.main.activeWidgetId === placement.widgetId);
      activePrimaryInstanceKey = active?.placementIdentity?.instanceKey;
    }
  }
  return { openStaticSlotIds, resourceInstances, activePrimaryInstanceKey };
};

export const loadWorkbenchLocationLayout = (
  input: createWorkbenchInput,
  context: WorkbenchPagePersistenceScopeInput,
) => {
  const scope = input.resolvePagePersistenceScope?.(context).scope;
  return input.persistence?.getSnapshot(scope)?.layout ?? input.layoutPersistence?.getLayout(scope);
};

export const createPageStateRestorer =
  (input: createWorkbenchInput) => (page: WorkbenchPageContribution, location: PageLocation, projectId: string) => {
    const layout = loadWorkbenchLocationLayout(input, {
      modeId: page.modeId,
      pageId: page.id,
      projectId,
      resource: location.resource,
    });
    if (
      !layout ||
      !Object.values(layout.regions).some((region) =>
        region.widgets.some(
          (placement) => placement.placementIdentity?.kind === "page" && placement.placementIdentity.pageId === page.id,
        ),
      )
    )
      return undefined;
    return pageStateFromLayout(page, layout);
  };
