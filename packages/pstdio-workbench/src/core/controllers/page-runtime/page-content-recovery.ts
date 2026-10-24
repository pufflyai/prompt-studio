import { pageSlots } from "../../registries/pages/page-main";
import { pagePlacementContributionId } from "../../registries/views/view-placement";
import type { WorkbenchCore } from "../../workbench-core-types";
import { createOwnedAddablePanels } from "../composition/owned-addable-panels";

export const getPageContentRecovery = (
  core: WorkbenchCore,
  state = core.pages.store.getState(),
  layout = core.layout.getLayout(),
) => {
  const page = state.activePageId ? state.pages[state.activePageId] : undefined;
  if (!page) return undefined;
  const main = page.main;
  const slot = pageSlots(page).find((slot) =>
    main.kind === "view" ? slot.role === "primary" : slot.id === main.landing,
  );
  if (!slot) return undefined;
  return createOwnedAddablePanels(core, {
    layout,
    region: "main",
    resource: state.location?.resource,
  }).find((panel) => panel.panelId === pagePlacementContributionId(page.id, slot.id));
};
