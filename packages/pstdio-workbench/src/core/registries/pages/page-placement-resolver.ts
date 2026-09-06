import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { contributionRefId } from "../../shared/contributions/reference-id";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import { PAGE_MAIN_SLOT_ID, pageSlots, type ResolvedPageSlot } from "./page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPagePlacementInput,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import { pageResourceBindingSlots, staticSlotOpen } from "./page-slot-lifecycle";

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
  return pageResourceBindingSlots(page, resource)
    .filter((slot) => slot.region !== "main")
    .filter((slot, index, slots) => slots.findIndex((candidate) => candidate.region === slot.region) === index)
    .map((slot) => pagePlacementIdentity(page.id, slot.id, resourceKey(resource)));
};

const validatePageSlots = (page: WorkbenchPageContribution) => {
  const ids = new Set<string>();
  for (const slot of page.slots) {
    if (slot.id === PAGE_MAIN_SLOT_ID || ids.has(slot.id))
      throw new Error(`Page "${page.id}" declares duplicate or reserved slot "${slot.id}"`);
    ids.add(slot.id);
    if (slot.item.kind === "binding" && slot.item.binding.kinds.length === 0)
      throw new Error(`Page slot "${slot.id}" must bind at least one resource kind`);
    if (slot.openOn && slot.item.kind !== "binding")
      throw new Error(`Page slot "${slot.id}" requires a binding for openOn`);
  }
};

export const validateWorkbenchPage = (page: WorkbenchPageContribution) => {
  if (page.ref.kind !== "page" || !page.ref.extensionId || !page.ref.id)
    throw new Error(`Page "${page.id}" must declare a normalized page ref`);
  if (page.path.startsWith("/") || page.path.endsWith("/"))
    throw new Error(`Page "${page.id}" must declare a normalized path`);
  if (!page.main || (page.main.kind !== "view" && page.main.kind !== "panels"))
    throw new Error(`Page "${page.id}" must declare Main content or a panel collection`);
  if (page.resource && page.resource.kinds.length === 0)
    throw new Error(`Page "${page.id}" must accept at least one resource kind`);
  if (page.main.kind === "view" && page.main.cardinality === "many" && !page.resource)
    throw new Error(`Page "${page.id}" requires a resource for many cardinality`);
  if (page.main.kind === "view" && page.resource && !page.parentId)
    throw new Error(`Resource page "${page.id}" must declare a parent`);
  validatePageSlots(page);
};

const placementFor = <Value>(input: {
  page: WorkbenchPageContribution;
  slot: ResolvedPageSlot;
  instanceKey: string;
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
  resource?: ResourceRef;
  section?: WorkbenchPagePlacementInput["section"];
  open?: WorkbenchPagePlacementInput["open"];
}) => {
  const item = input.slot.item;
  const view = item.kind === "view" ? item.view : item.binding.view;
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
      viewId: contributionRefId(view),
      ...(input.resource ? { resource: input.resource } : {}),
      ...(input.section ? { section: input.section } : {}),
      ...(input.open ? { open: input.open } : {}),
      closable: item.kind === "binding" || item.presence !== "fixed",
    }),
  } satisfies ResolvedOwnedPlacement<Value>;
};

export const resolvePagePlacements = <Value>(input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  resource?: ResourceRef;
  sharedPlacements: readonly ResolvedOwnedPlacement<Value>[];
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
}) => {
  const placements: ResolvedOwnedPlacement<Value>[] = [];
  for (const slot of pageSlots(input.page)) {
    if (staticSlotOpen(slot, input.state)) placements.push(placementFor({ ...input, slot, instanceKey: "default" }));
    for (const instance of input.state.resourceInstances[slot.id] ?? []) {
      placements.push(placementFor({ ...input, slot, ...instance }));
    }
  }
  if (
    input.page.main.kind === "panels" &&
    ![...placements, ...input.sharedPlacements].some((placement) => placement.region === "main")
  ) {
    placements.push(
      placementFor({
        ...input,
        instanceKey: "default",
        slot: {
          id: PAGE_MAIN_SLOT_ID,
          role: "primary",
          region: "main",
          item: { kind: "view", view: input.page.main.empty, presence: "fixed" },
        },
      }),
    );
  }
  return placements;
};
