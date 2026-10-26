import { contributionRefId, isLocalizedString } from "@pstdio/sdk/extensions";
import type { NavigationTarget } from "../../registries/navigation/navigation-registry";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import type { WorkbenchCore } from "../../workbench-core-types";

const destinationLabel = (core: WorkbenchCore, action: NavigationTarget): string => {
  if (action.kind === "command") return core.commands.getCommand(action.commandId)?.command.label ?? action.commandId;
  if (action.kind === "href") return action.href;
  if (action.kind === "viewer") return action.resource.label ?? action.resource.id;
  if (action.kind === "compound") return action.targets.map((target) => destinationLabel(core, target)).join(" + ");
  if (action.kind === "page") {
    const title = core.pages.store.getState().pages[contributionRefId(action.page)]?.title;
    if (isLocalizedString(title)) return title.default ?? title.$l10n;
    return title ?? action.page.id;
  }
  const panel = action.panel;
  if (panel.kind === "shell-placement") return core.layout.getWidget(panel.id)?.title ?? panel.id;
  const placement =
    panel.kind === "page-slot"
      ? core.pages.store.getState().pages[contributionRefId(panel.page)]?.slots.find((slot) => slot.id === panel.id)
      : core.modePlacements
          .listPlacements()
          .find((placement) => contributionRefId(placement.ref) === contributionRefId(panel));
  if (!placement) return panel.id;
  const view = placement.item.kind === "view" ? placement.item.view : placement.item.binding.view;
  return core.views.getView(contributionRefId(view))?.title ?? panel.id;
};
export const shortcutActionLabel = (core: WorkbenchCore, action: NavigationTarget) => {
  const navigation = core.navigationTrees
    .listActions()
    .find((candidate) => getNavigationTargetKey(candidate.action) === getNavigationTargetKey(action));
  return navigation?.label ?? destinationLabel(core, action);
};
