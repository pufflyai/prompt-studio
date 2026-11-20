import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import { findPlacementByWidgetId } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { PlacementDestination } from "../../registries/layout/placement-reconciliation";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { resolvePageContent } from "../../registries/pages/page-content";
import { pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import type { OwnedPlacementState } from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { getPageLocationPreparation } from "../page-location/page-location-preparation";
import { pageLocationTarget } from "../page-location/page-location-target";
import { portablePagePanel } from "../page-runtime/portable-page-panel";
import { preparePageNavigation } from "./page-navigation-preparation";

const panelRegion = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  destinations: ReadonlyMap<string, PlacementDestination>,
) => {
  if (target.region) return target.region;
  const ref = target.panel;
  let declaration: { id: string; region: string } | undefined;
  let matches: (
    identity: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>["placements"][number]["identity"],
  ) => boolean;
  if (ref.kind === "placement") {
    declaration = core.modePlacements.getPlacement(ref);
    matches = (identity) => identity.kind === "mode" && identity.placementId === declaration?.id;
  } else if (ref.kind === "shell-placement") {
    declaration = core.shellPlacements.getPlacement(ref.id);
    matches = (identity) => identity.kind === "shell" && identity.placementId === ref.id;
  } else {
    const page = Object.values(state.pages).find(
      (page) => page.ref.id === ref.page.id && page.ref.extensionId === ref.page.extensionId,
    );
    declaration = page && pageSlots(page).find((slot) => slot.id === ref.id);
    matches = (identity) => identity.kind === "page" && identity.pageId === page?.id && identity.slotId === ref.id;
  }
  const existing = state.placements.find(
    (entry) =>
      matches(entry.identity) &&
      (!target.resource ||
        (entry.value.resource &&
          core.pages.resourceReferenceKey(entry.value.resource) === core.pages.resourceReferenceKey(target.resource))),
  );
  if (existing)
    return (
      destinations.get(placementIdentityKey(existing.identity))?.region ??
      findPlacementByWidgetId(core.layout.getLayout(), existing.value.widgetId)?.regionId ??
      existing.region
    );
  return declaration?.region;
};

const fallbackTarget = (core: WorkbenchCore, state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) => {
  const locations = getPageLocationPreparation(core.pageLocations);
  const source = state.pages[state.activePageId ?? ""];
  try {
    const fallback = locations.defaultTarget();
    if (state.pages[fallback.pageId]?.modeId === state.activeModeId && fallback.pageId !== source?.id)
      return pageLocationTarget(fallback.location);
  } catch {
    /* A mode can remain usable while its configured default is unavailable. */
  }
  let parent = source?.parentId;
  while (parent) {
    const page = state.pages[parent];
    if (!page || page.modeId !== state.activeModeId) break;
    if (!page.resource) {
      const resolved = locations.resolve({ kind: "page", page: page.ref });
      if (resolved.pageId !== source?.id) return pageLocationTarget(resolved.location);
    }
    parent = page.parentId;
  }
};

export const planMainDeparture = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  destinations: ReadonlyMap<string, PlacementDestination>,
) => {
  const source = resolvePageContent(state);
  if (!source || target.kind !== "panel" || panelRegion(core, target, state, destinations) === "main") return;
  const page = state.pages[state.activePageId!];
  const portable = page && portablePagePanel(page, core.modePlacements);
  const sameResource =
    source.resource &&
    target.resource &&
    core.pages.resourceReferenceKey(source.resource) === core.pages.resourceReferenceKey(target.resource);
  const staticPage =
    !source.resource &&
    !target.resource &&
    target.panel.kind === "placement" &&
    target.panel.id === portable?.id &&
    target.panel.extensionId === portable.extensionId;
  if (!sameResource && !staticPage) return;
  return { source, target: fallbackTarget(core, state) };
};

export const prepareMainDeparture = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  page: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  mode: OwnedPlacementState,
  shell: OwnedPlacementState,
  destinations: ReadonlyMap<string, PlacementDestination>,
) => {
  const departure = planMainDeparture(core, target, page, destinations);
  if (!departure) return { page, mode, shell };
  if (departure.target) {
    const prepared = preparePageNavigation(core, departure.target, page, mode, shell);
    return { page: prepared.state, mode: prepared.mode, shell: prepared.shell, source: departure.source };
  }
  const state = getWorkbenchPageRegistryInternals(core.pages).prepare.compose(
    page,
    { ...page, activePageId: undefined, location: undefined, activate: [], action: "departMainPage" },
    {
      mode: getOwnedPlacementPreparation(core.modePlacements).resolve(page.activeModeId, mode),
      shell: getOwnedPlacementPreparation(core.shellPlacements).resolve(undefined, shell),
    },
  );
  return { page: state, mode, shell, source: departure.source };
};
