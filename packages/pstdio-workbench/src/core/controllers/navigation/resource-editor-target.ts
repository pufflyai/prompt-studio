import { contributionRefId } from "@pstdio/sdk/extensions";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";

const panelTargetItem = (core: WorkbenchCore, target: NavigationTargetPanel) => {
  const panel = target.panel;
  if (panel.kind === "placement") return core.modePlacements.getPlacement(panel)?.item;
  if (panel.kind === "shell-placement") return core.shellPlacements.getPlacement(panel.id)?.item;
  return core.pages
    .listPages()
    .find((p) => contributionRefId(p.ref) === contributionRefId(panel.page))
    ?.slots.find((s) => s.id === panel.id)?.item;
};

export const resourceEditorTarget = (core: WorkbenchCore, target: NavigationTargetPage | NavigationTargetPanel) => {
  if (!target.resource) return undefined;
  if (target.kind === "page") {
    const page = core.pages.listPages().find((p) => contributionRefId(p.ref) === contributionRefId(target.page));
    if (!page?.resource || !resourceMatchesConstraint(page.resource, target.resource))
      throw new Error(`Page does not accept resource kind: ${target.resource.type}`);
    if (target.open && page.main.kind === "view" && page.main.cardinality !== "many")
      throw new Error("Page accepts open intent only with many cardinality");
    return page?.main.kind === "view"
      ? { viewId: contributionRefId(page.main.view), resource: target.resource }
      : undefined;
  }
  const item = panelTargetItem(core, target);
  if (item?.kind === "binding" && !resourceMatchesConstraint(item.binding, target.resource))
    throw new Error(`Panel does not accept resource kind: ${target.resource.type}`);
  if (target.open && item?.kind === "binding" && item.binding.cardinality !== "many")
    throw new Error("Panel accepts open intent only with many cardinality");
  return item?.kind === "binding"
    ? { viewId: contributionRefId(item.binding.view), resource: target.resource }
    : undefined;
};
