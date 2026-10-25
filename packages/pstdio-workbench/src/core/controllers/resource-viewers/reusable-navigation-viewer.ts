import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { isPageContent, isSingleViewPage, pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import type { WorkbenchCore } from "../../workbench-core-types";
import { requirePanelOpen } from "../shell/panel-open-policy";
import { resourceViewerBinding } from "./displayed-viewers";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
const targetBinding = (core: WorkbenchCore, target: NavigationTargetPage | NavigationTargetPanel, state: State) => {
  if (target.kind === "page") {
    const page = Object.values(state.pages).find(
      (page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId,
    );
    return page?.resource && page.modeId === state.activeModeId ? page.resource : undefined;
  }
  const ref = target.panel;
  if (ref.kind === "placement") {
    const placement = core.modePlacements.getPlacement(ref);
    return placement && placement.modeId === state.activeModeId && placement.item.kind === "binding"
      ? placement.item.binding
      : undefined;
  }
  if (ref.kind === "shell-placement") {
    const placement = core.shellPlacements.getPlacement(ref.id);
    return placement?.item.kind === "binding" ? placement.item.binding : undefined;
  }
  const page = Object.values(state.pages).find(
    (page) => page.ref.id === ref.page.id && page.ref.extensionId === ref.page.extensionId,
  );
  const slot = page && pageSlots(page).find((slot) => slot.id === ref.id);
  return page?.id === state.activePageId && slot?.item.kind === "binding" ? slot.item.binding : undefined;
};
const actualRegion = (core: WorkbenchCore, identity: PlacementIdentity) =>
  Object.values(core.layout.getLayout().regions).find((region) =>
    region.widgets.some(
      (widget) =>
        widget.placementIdentity && placementIdentityKey(widget.placementIdentity) === placementIdentityKey(identity),
    ),
  )?.id;

/** Reuse only viewers surviving the proposed layout; history never reserves a resource. */
export const reusableNavigationViewer = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  state: State,
) => {
  if (!target.resource || (target.kind === "page" && target.intent === "restore")) return undefined;
  const binding = targetBinding(core, target, state);
  if (!binding) return undefined;
  if (!resourceMatchesConstraint(binding, target.resource))
    throw new Error("Viewer does not accept this resource kind");
  const key = core.pages.resourceReferenceKey(target.resource);
  const page = state.pages[state.activePageId ?? ""];
  const match = state.placements.find((placement) => {
    if (!placement.value.resource || resourceViewerBinding(core, placement.identity)?.kind !== "binding") return false;
    const region = actualRegion(core, placement.identity) ?? placement.region;
    if (region === "main" && isSingleViewPage(page) && !isPageContent(page, placement.identity)) return false;
    return core.pages.resourceReferenceKey(placement.value.resource) === key;
  });
  if (!match) return undefined;
  const region = actualRegion(core, match.identity) ?? match.region;
  if (!isPageContent(page, match.identity))
    requirePanelOpen(core, region, { identity: match.identity, proposed: state, modeId: state.activeModeId });
  return { identity: match.identity, region };
};
