import type { PlacementIdentity, ResourceBinding } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageSlot } from "./page-registry-types";

export const PAGE_MAIN_SLOT_ID = "$main";

export const isSingleViewPage = (page: WorkbenchPageContribution | undefined) =>
  page?.main.kind === "view" && page.main.presentation === "page";

export const isPageContent = (page: WorkbenchPageContribution | undefined, identity: PlacementIdentity | undefined) =>
  isSingleViewPage(page) &&
  identity?.kind === "page" &&
  identity.pageId === page?.id &&
  identity.slotId === PAGE_MAIN_SLOT_ID;

export interface ResolvedPageSlot extends WorkbenchPageSlot {
  readonly role: "primary" | "auxiliary";
}

export const primarySlot = (page: WorkbenchPageContribution): ResolvedPageSlot | undefined => {
  if (page.main.kind !== "view") return undefined;
  const { kind: _kind, view, cardinality, empty: _empty, presentation: _presentation, ...presentation } = page.main;
  const binding: ResourceBinding | undefined = page.resource ? { ...page.resource, view, cardinality } : undefined;
  return {
    ...presentation,
    id: PAGE_MAIN_SLOT_ID,
    role: "primary",
    region: "main",
    item: binding ? { kind: "binding", binding } : { kind: "view", view, presence: "open" },
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
