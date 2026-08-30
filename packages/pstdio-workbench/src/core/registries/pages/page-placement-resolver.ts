import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type {
  WorkbenchPageContribution,
  WorkbenchPagePlacementInput,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
} from "./page-registry-types";

export const pagePlacementIdentity = (pageId: string, slotId: string, instanceKey: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

export const validateWorkbenchPage = (page: WorkbenchPageContribution) => {
  const primary = page.slots.filter((slot) => slot.role === "primary");
  if (primary.length !== 1 || primary[0]?.region !== "main") {
    throw new Error(`Page "${page.id}" must declare exactly one primary slot in main`);
  }
  const slotIds = new Set<string>();
  for (const slot of page.slots) {
    if (slotIds.has(slot.id)) throw new Error(`Page "${page.id}" declares duplicate slot "${slot.id}"`);
    slotIds.add(slot.id);
  }
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
  const viewId = input.resource ? input.slot.binding?.viewId : input.slot.viewId;
  if (!viewId) throw new Error(`Page slot "${input.page.id}.${input.slot.id}" has no view for its active instance`);
  const staticPrimary = input.slot.role === "primary" && input.slot.viewId && !input.resource;
  return {
    identity: pagePlacementIdentity(input.page.id, input.slot.id, input.instanceKey),
    region: input.slot.region,
    order: input.slot.order ?? 0,
    value: input.resolvePagePlacement({
      pageId: input.page.id,
      slotId: input.slot.id,
      role: input.slot.role,
      viewId,
      ...(input.resource ? { resource: input.resource } : {}),
      ...(input.section ? { section: input.section } : {}),
      ...(input.open ? { open: input.open } : {}),
      closable: staticPrimary ? false : Boolean(input.slot.closable),
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
    const showPrimaryDefault = slot.role === "primary" && Boolean(slot.viewId);
    const showAuxiliaryStatic =
      slot.role === "auxiliary" && Boolean(slot.viewId) && input.state.openStaticSlotIds.includes(slot.id);
    if (showPrimaryDefault || showAuxiliaryStatic) {
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
