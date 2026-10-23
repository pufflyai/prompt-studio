import { contributionRefId } from "@pstdio/sdk/extensions";
import { pageSlots } from "../../registries/pages/page-main";
import { pageResourceContextKey } from "../../registries/pages/page-resource-context";
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
  const existing =
    slot &&
    Object.values(layout.regions)
      .flatMap((region) => region.widgets)
      .find((tab) => {
        const owner = tab.placementIdentity;
        return (
          owner?.kind === "page" &&
          owner.pageId === page.id &&
          owner.slotId === slot.id &&
          pageResourceContextKey(page, tab.resource) === pageResourceContextKey(page, state.location?.resource)
        );
      });
  const addable =
    slot &&
    createOwnedAddablePanels(core, {
      layout,
      region: "main",
      resource: state.location?.resource,
    }).find((panel) => panel.panelId === pagePlacementContributionId(page.id, slot.id));
  return {
    viewId: main.empty ? contributionRefId(main.empty) : undefined,
    resource: state.location?.resource,
    label: existing ? "Move back" : "Reopen",
    open: addable?.open,
  };
};
