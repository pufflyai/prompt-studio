import type { ResourceBinding } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageSlot } from "./page-registry-types";

export const PAGE_MAIN_SLOT_ID = "$main";

export interface ResolvedPageSlot extends WorkbenchPageSlot {
  readonly role: "primary" | "auxiliary";
}

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
