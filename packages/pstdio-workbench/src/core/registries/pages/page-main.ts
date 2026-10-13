import type { ResourceBinding, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageSlot } from "./page-registry-types";

export const PAGE_MAIN_SLOT_ID = "$main";

// A many-resource Main owns one collection. Its route selects a tab in that owner.
export const pageOwnerResource = (page: WorkbenchPageContribution | undefined, resource?: ResourceRef) =>
  page?.main.kind === "view" && page.main.cardinality === "many" ? undefined : resource;

export interface ResolvedPageSlot extends WorkbenchPageSlot {
  readonly role: "primary" | "auxiliary";
}

export const isPageSlotClosable = (slot: ResolvedPageSlot) => {
  if (slot.item.kind === "view") return slot.item.presence !== "fixed";
  // A single-resource Main is the page itself, not a dismissible resource tab.
  return slot.role !== "primary" || slot.item.binding.cardinality === "many";
};

export const primarySlot = (page: WorkbenchPageContribution): ResolvedPageSlot | undefined => {
  if (page.main.kind !== "view") return undefined;
  const { kind: _kind, view, cardinality, ...presentation } = page.main;
  const binding: ResourceBinding | undefined = page.resource ? { ...page.resource, view, cardinality } : undefined;
  return {
    ...presentation,
    id: PAGE_MAIN_SLOT_ID,
    role: "primary",
    region: "main",
    item: binding ? { kind: "binding", binding } : { kind: "view", view, presence: "fixed" },
  };
};

export const pageSlots = (page: WorkbenchPageContribution): ResolvedPageSlot[] => {
  const main = primarySlot(page);
  return [...(main ? [main] : []), ...page.slots.map((slot) => ({ ...slot, role: "auxiliary" as const }))];
};

export const requirePageSlot = (page: WorkbenchPageContribution, slotId: string) => {
  const slot = pageSlots(page).find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error(`Unknown page slot: ${page.id}.${slotId}`);
  return slot;
};

export const emptyMainSlot = (page: WorkbenchPageContribution): ResolvedPageSlot | undefined => {
  if (page.main.kind !== "panels") return undefined;
  return {
    id: PAGE_MAIN_SLOT_ID,
    role: "primary",
    region: "main",
    item: { kind: "view", view: page.main.empty, presence: "fixed" },
  };
};
export const pagePlacementDeclarations = (page: WorkbenchPageContribution) => {
  const empty = emptyMainSlot(page);
  return [...pageSlots(page), ...(empty ? [empty] : [])];
};
