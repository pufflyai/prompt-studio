import { contributionRefId, type PlacementIdentity, type ViewLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { isPageContent, pageSlots } from "../../registries/pages/page-main";
import { editPagePlacementStates } from "../../registries/pages/page-placement-state";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import {
  closeOwnedPlacementInstance,
  type OwnedPlacementState,
  type WorkbenchOwnedPlacementItem,
} from "../../registries/placements/owned-placement-lifecycle";
import { getOwnedPlacementPreparation } from "../../registries/placements/owned-placement-preparation";
import type { WorkbenchCore } from "../../workbench-core-types";
import { portablePagePanel } from "../page-runtime/portable-page-panel";
import { resourceViewerBinding } from "../resource-viewers/displayed-viewers";

export const retireTransferredSource = (
  core: WorkbenchCore,
  identity: PlacementIdentity,
  page: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  mode: OwnedPlacementState,
  shell: OwnedPlacementState,
) => {
  if (identity.kind === "page")
    return {
      page: { ...page, pageStates: editPagePlacementStates(page.pageStates, identity, { kind: "close" }) },
      mode,
      shell,
    };
  const item = resourceViewerBinding(core, identity);
  if (!item) return { page, mode, shell };
  const current = identity.kind === "mode" ? mode : shell;
  const state = {
    ...current,
    staticOverrides: new Map(current.staticOverrides),
    staticLocations: new Map(current.staticLocations),
    resourceInstances: new Map(current.resourceInstances),
  };
  closeOwnedPlacementInstance({
    label: "Resource view",
    id: identity.placementId,
    item,
    instanceKey: identity.instanceKey,
    state,
  });
  return { page, mode: identity.kind === "mode" ? state : mode, shell: identity.kind === "shell" ? state : shell };
};

export const matchingStaticPagePlacement = (
  core: WorkbenchCore,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  target: NavigationTargetPage | NavigationTargetPanel,
) => {
  if (target.resource) return;
  const page =
    target.kind === "page"
      ? Object.values(state.pages).find(
          (page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId,
        )
      : state.pages[state.activePageId ?? ""];
  if (!page || page.resource || page.main.kind !== "view" || page.main.presentation !== "page") return;
  const ref = portablePagePanel(page, core.modePlacements);
  const declaration = ref && core.modePlacements.getPlacement(ref);
  if (!declaration) return;
  if (target.kind === "page")
    return state.placements.find(
      (entry) => entry.identity.kind === "mode" && entry.identity.placementId === declaration.id,
    );
  if (target.panel.kind !== "placement" || target.panel.id !== ref?.id || target.panel.extensionId !== ref.extensionId)
    return;
  return state.placements.find((entry) => isPageContent(page, entry.identity));
};

export const retainTransferredPin = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  if (!target.resource || matchingResourcePlacement(core, state, target.resource)?.value.tabRetention !== "persistent")
    return target;
  if (target.kind === "page") {
    const page = Object.values(state.pages).find(
      (page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId,
    );
    if (page?.main.kind === "view" && page.main.cardinality === "many") return { ...target, open: "pin" as const };
    return target;
  }
  const ref = target.panel;
  let item: WorkbenchOwnedPlacementItem | undefined;
  if (ref.kind === "placement") item = core.modePlacements.getPlacement(ref)?.item;
  if (ref.kind === "shell-placement") item = core.shellPlacements.getPlacement(ref.id)?.item;
  return item?.kind === "binding" && item.binding.cardinality === "many" ? { ...target, open: "pin" as const } : target;
};

export const matchingResourcePlacement = (
  core: WorkbenchCore,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  resource: NonNullable<WorkbenchWidgetPlacement["resource"]>,
  identities?: readonly PlacementIdentity[],
) => {
  const allowed = identities && new Set(identities.map(placementIdentityKey));
  const key = core.pages.resourceReferenceKey(resource);
  return state.placements.find(
    (placement) =>
      (!allowed || allowed.has(placementIdentityKey(placement.identity))) &&
      placement.value.resource &&
      resourceViewerBinding(core, placement.identity)?.kind === "binding" &&
      core.pages.resourceReferenceKey(placement.value.resource) === key,
  );
};

export const panelTransferLocation = (
  core: WorkbenchCore,
  target: NavigationTargetPanel,
  current: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  original: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
  requested?: ViewLocation,
  departing?: WorkbenchWidgetPlacement,
) => {
  const source =
    departing ??
    (target.resource &&
      (
        matchingResourcePlacement(core, current, target.resource) ??
        matchingResourcePlacement(core, original, target.resource)
      )?.value);
  if (!source) return requested;
  const ref = target.panel;
  let item: WorkbenchOwnedPlacementItem | undefined;
  if (ref.kind === "placement") item = core.modePlacements.getPlacement(ref)?.item;
  else if (ref.kind === "shell-placement") item = core.shellPlacements.getPlacement(ref.id)?.item;
  else {
    const page = Object.values(current.pages).find(
      (page) => page.ref.id === ref.page.id && page.ref.extensionId === ref.page.extensionId,
    );
    item = page && pageSlots(page).find((slot) => slot.id === ref.id)?.item;
  }
  const view = item && contributionRefId(item.kind === "view" ? item.view : item.binding.view);
  if (view !== source.viewId) return requested;
  return {
    section: source.section,
    position: source.position,
    pageContext: source.pageContext ?? source.pageOwnerLocation,
    ...requested,
  };
};

export const prepareResourceTransfer = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  input: {
    before: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
    original: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
    page: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;
    mode: OwnedPlacementState;
    shell: OwnedPlacementState;
    replacement?: WorkbenchWidgetPlacement;
  },
) => {
  let { page, mode, shell } = input;
  if (target.kind === "page" && target.intent === "restore") return { page, mode, shell, hosts: [] };
  const activations = page.reconciliation.activate.map((entry) => entry.identity);
  const keys = new Set(activations.map(placementIdentityKey));
  const replacement =
    input.replacement?.placementIdentity &&
    (input.original.placements.find(
      (entry) => placementIdentityKey(entry.identity) === placementIdentityKey(input.replacement!.placementIdentity!),
    ) ?? { identity: input.replacement.placementIdentity, value: input.replacement });
  const found = target.resource
    ? (matchingResourcePlacement(core, input.before, target.resource) ??
      matchingResourcePlacement(core, input.original, target.resource))
    : (matchingStaticPagePlacement(core, input.before, target) ??
      matchingStaticPagePlacement(core, input.original, target));
  const sameResource =
    target.resource &&
    replacement?.value.resource &&
    core.pages.resourceReferenceKey(target.resource) === core.pages.resourceReferenceKey(replacement.value.resource);
  const source = sameResource ? replacement : (found ?? replacement);
  const destination = target.resource
    ? matchingResourcePlacement(core, page, target.resource, activations)
    : page.placements.find(
        (entry) => keys.has(placementIdentityKey(entry.identity)) && entry.value.viewId === source?.value.viewId,
      );
  const retire = (identity: PlacementIdentity) => {
    const next = retireTransferredSource(core, identity, page, mode, shell);
    mode = next.mode;
    shell = next.shell;
    page = getWorkbenchPageRegistryInternals(core.pages).prepare.compose(
      page,
      { ...next.page, activate: activations, action: "transferResourceViewer" },
      {
        mode: getOwnedPlacementPreparation(core.modePlacements).resolve(page.activeModeId, mode),
        shell: getOwnedPlacementPreparation(core.shellPlacements).resolve(undefined, shell),
      },
    );
  };
  let host: { source: WorkbenchWidgetPlacement; destination: WorkbenchWidgetPlacement } | undefined;
  if (source && destination && placementIdentityKey(source.identity) !== placementIdentityKey(destination.identity)) {
    retire(source.identity);
    host = {
      source: { ...source.value, placementIdentity: source.identity },
      destination: { ...destination.value, placementIdentity: destination.identity },
    };
  }
  if (
    replacement &&
    destination &&
    placementIdentityKey(replacement.identity) !== placementIdentityKey(destination.identity) &&
    placementIdentityKey(replacement.identity) !== (source && placementIdentityKey(source.identity))
  )
    retire(replacement.identity);
  return { page, mode, shell, hosts: host ? [host] : [] };
};

export const finalHostTransfers = (
  transfers: { source: WorkbenchWidgetPlacement; destination: WorkbenchWidgetPlacement }[],
  final: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const origins = new Map<string, WorkbenchWidgetPlacement>();
  for (const { source, destination } of transfers)
    origins.set(destination.widgetId, origins.get(source.widgetId) ?? source);
  return final.placements.flatMap((entry) => {
    const source = origins.get(entry.value.widgetId);
    return source && source.widgetId !== entry.value.widgetId
      ? [{ source, destination: { ...entry.value, placementIdentity: entry.identity } }]
      : [];
  });
};
