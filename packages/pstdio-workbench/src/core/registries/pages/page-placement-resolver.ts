import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type {
  WorkbenchPageContribution,
  WorkbenchPagePlacementInput,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
} from "./page-registry-types";
import { pageResourceBindingSlots, primarySlot, staticSlotOpen } from "./page-slot-lifecycle";

export const pagePlacementIdentity = (pageId: string, slotId: string, instanceKey: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

export const pageFollowerIdentities = (
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  resourceKey: (resource: ResourceRef) => string,
) => {
  if (!resource) return [];
  const primary = primarySlot(page);
  return pageResourceBindingSlots(page, resource)
    .filter((slot) => slot.region !== primary.region)
    .filter((slot, index, slots) => slots.findIndex((candidate) => candidate.region === slot.region) === index)
    .map((slot) => pagePlacementIdentity(page.id, slot.id, resourceKey(resource)));
};

export const validateWorkbenchPage = (page: WorkbenchPageContribution) => {
  if (page.ref.kind !== "page" || !page.ref.extensionId || !page.ref.id) {
    throw new Error(`Page "${page.id}" must declare a normalized page ref`);
  }
  if (page.path.startsWith("/") || page.path.endsWith("/")) {
    throw new Error(`Page "${page.id}" must declare a normalized path`);
  }
  const primary = page.slots.filter((slot) => slot.role === "primary");
  if (primary.length !== 1 || primary[0]?.region !== "main") {
    throw new Error(`Page "${page.id}" must declare exactly one primary slot in main`);
  }
  const slotIds = new Set<string>();
  for (const slot of page.slots) {
    if (Boolean(slot.viewId) === Boolean(slot.binding)) {
      throw new Error(`Page slot "${slot.id}" must define exactly one view or binding`);
    }
    if (slotIds.has(slot.id)) throw new Error(`Page "${page.id}" declares duplicate slot "${slot.id}"`);
    slotIds.add(slot.id);
  }
};

const instanceClosable = (slot: WorkbenchPageSlot, resource: boolean) => {
  if (slot.role === "primary") return resource;
  if (slot.viewId) return slot.presence !== "fixed";
  return true;
};

const placementFor = <Value>(input: {
  page: WorkbenchPageContribution;
  slot: WorkbenchPageSlot;
  instanceKey: string;
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
  resource?: WorkbenchPagePlacementInput["resource"];
  section?: WorkbenchPagePlacementInput["section"];
  open?: WorkbenchPagePlacementInput["open"];
}): ResolvedOwnedPlacement<Value> => {
  const binding =
    input.resource && input.slot.binding?.resourceKinds.includes(input.resource.type) ? input.slot.binding : undefined;
  const viewId = input.resource ? binding?.viewId : input.slot.viewId;
  if (!viewId) throw new Error(`Page slot "${input.page.id}.${input.slot.id}" has no view for its active instance`);
  const identity = pagePlacementIdentity(input.page.id, input.slot.id, input.instanceKey);
  return {
    identity,
    region: input.slot.region,
    order: input.slot.order ?? 0,
    value: input.resolvePagePlacement({
      identity,
      pageId: input.page.id,
      slotId: input.slot.id,
      role: input.slot.role,
      viewId,
      ...(input.resource ? { resource: input.resource } : {}),
      ...(input.section ? { section: input.section } : {}),
      ...(input.open ? { open: input.open } : {}),
      closable: instanceClosable(input.slot, Boolean(input.resource)),
    }),
  };
};

export const resolvePagePlacements = <Value>(input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
}) => {
  const placements: ResolvedOwnedPlacement<Value>[] = [];
  for (const slot of input.page.slots) {
    const resources = input.state.resourceInstances[slot.id] ?? [];
    const showPrimary = slot.role === "primary" && Boolean(slot.viewId);
    if (showPrimary || staticSlotOpen(slot, input.state)) {
      placements.push(
        placementFor({
          page: input.page,
          slot,
          instanceKey: "default",
          resolvePagePlacement: input.resolvePagePlacement,
        }),
      );
    }
    for (const instance of resources) {
      placements.push(
        placementFor({
          page: input.page,
          slot,
          instanceKey: instance.instanceKey,
          resolvePagePlacement: input.resolvePagePlacement,
          resource: instance.resource,
          ...(instance.section ? { section: instance.section } : {}),
          ...(instance.open ? { open: instance.open } : {}),
        }),
      );
    }
  }
  return placements;
};
