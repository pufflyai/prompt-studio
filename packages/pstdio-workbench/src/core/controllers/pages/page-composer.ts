import type { WorkbenchPageContribution, WorkbenchPageSlot } from "../../registries/pages/page-registry";
import { bySlotOrder, dropForeignWidgets, shouldOpenStaticSlot } from "./page-composition-rules";
import type { CreatePageControllerInput } from "./page-controller";

// Owns how a page's declared regions are filled and emptied: seeding a fresh
// arrangement, reconciling a restored one, and releasing the page's panels when the
// bench goes back to the mode.
export const createPageComposer = (input: CreatePageControllerInput, warn: (message: string) => void) => {
  const openStaticSlot = (page: WorkbenchPageContribution, slot: WorkbenchPageSlot) => {
    if (!slot.panelId) return;
    if (!input.layout.getPanel(slot.panelId)) {
      warn(`Page "${page.id}" slot "${slot.id}" names an unregistered panel "${slot.panelId}"`);
      return;
    }
    input.openPanel(slot.panelId, {
      region: slot.region,
      role: slot.region === "main" ? "location" : "sub-panel",
      pinned: true,
      closable: slot.closable,
      pageId: page.id,
      strategy: { kind: "persistent" },
    });
  };

  const composeRegions = (page: WorkbenchPageContribution, seed: boolean) => {
    for (const region of new Set(page.slots.map((slot) => slot.region))) {
      dropForeignWidgets(input.layout, page, region, seed);
    }
    for (const slot of [...page.slots].sort(bySlotOrder)) {
      if (shouldOpenStaticSlot(input.layout, page, slot, seed)) openStaticSlot(page, slot);
    }
  };

  const releaseRegions = (page: WorkbenchPageContribution) => {
    for (const region of new Set(page.slots.map((slot) => slot.region))) {
      dropForeignWidgets(input.layout, page, region, true);
    }
  };

  return { composeRegions, openStaticSlot, releaseRegions };
};
