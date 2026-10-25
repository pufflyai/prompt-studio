import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import {
  composeOwnedPlacements,
  type ResolvedOwnedPlacement,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { pageFollowerIdentities, pagePlacementIdentity, resolvePagePlacements } from "./page-placement-resolver";
import type { WorkbenchPageLocationCommitInput } from "./page-registry-internals";
import { type PageRegistryCommitInput, resolveModePlacementSet } from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlotOpenInput,
} from "./page-registry-types";
import { pageResourceContextKey, pageResourceInstanceKey } from "./page-resource-context";
import {
  emptyPageState,
  openPageResourceBindings,
  openResourceSlot,
  primarySlot,
  requirePageSlot,
  selectPrimaryTarget,
  setStaticSlotOpen,
} from "./page-slot-lifecycle";
import { pageStateKey, staticPageInstanceKey } from "./page-state-key";

export interface PreparedOwnedPlacements<Value> {
  shell?: readonly ResolvedOwnedPlacement<Value>[];
  mode: readonly ResolvedOwnedPlacement<Value>[];
  landing?: PlacementIdentity;
}
const locationActivations = (
  page: WorkbenchPageContribution,
  state: WorkbenchPageRuntimeState,
  target: WorkbenchPageLocationCommitInput,
  resources: WorkbenchPageResourceCodec,
  openFollowers: boolean,
) => {
  const primary = primarySlot(page);
  const instanceKey = state.activePrimaryInstanceKey;
  const main = page.main;
  const landing =
    main.kind === "panels" && !target.pageStates
      ? page.slots.find((slot) => slot.id === main.landing && (!slot.isAvailable || slot.isAvailable(target.resource)))
      : undefined;
  const followers = openFollowers
    ? pageFollowerIdentities(page, target.resource, (resource) => pageResourceInstanceKey(page, resource, resources))
    : [];
  return [
    ...(primary && instanceKey ? [pagePlacementIdentity(page.id, primary.id, instanceKey)] : []),
    ...(landing
      ? [pagePlacementIdentity(page.id, landing.id, staticPageInstanceKey(page, target.resource, resources))]
      : []),
    ...followers,
  ];
};
export const createPagePreparation = <Value>(input: CreateWorkbenchPageRegistryInput<Value>) => {
  const normalizeResource = input.resources.normalize;
  const requirePage = (current: WorkbenchPageRegistryStoreState<Value>, pageId: string) => {
    const page = current.pages[pageId];
    if (!page) throw new Error(`Unknown page: ${pageId}`);
    return page;
  };
  const compose = (
    current: WorkbenchPageRegistryStoreState<Value>,
    next: PageRegistryCommitInput<Value>,
    owned?: PreparedOwnedPlacements<Value>,
  ) => {
    const page = next.activePageId ? current.pages[next.activePageId] : undefined;
    const pageState = page ? next.pageStates[pageStateKey(page, next.location, input.resources)] : undefined;
    if (next.activeModeId) input.validateMode?.(next.activeModeId);
    const modePlacements =
      owned?.mode ??
      resolveModePlacementSet({
        current,
        modeId: next.activeModeId,
        desired: next.modePlacements,
        location: next.location,
        projectId: next.projectId,
        pageId: next.activePageId,
        resolveModePlacements: input.resolveModePlacements,
      });
    if (
      next.activeModeId &&
      modePlacements?.some(
        (placement) => placement.identity.kind !== "mode" || placement.identity.modeId !== next.activeModeId,
      )
    )
      throw new Error(`Mode placement owner does not match active mode: ${next.activeModeId}`);
    const shell =
      owned?.shell ??
      input.resolveShellPlacements(
        next.activeModeId
          ? { modeId: next.activeModeId, pageId: next.activePageId, projectId: next.projectId, location: next.location }
          : undefined,
      );
    const composed = composeOwnedPlacements({
      shell,
      mode: modePlacements,
      ...(page && pageState
        ? {
            page: resolvePagePlacements({
              page,
              state: pageState,
              staticInstanceKey: staticPageInstanceKey(page, next.location?.resource, input.resources),
              resource: next.location?.resource,
              sharedPlacements: [...shell, ...(modePlacements ?? [])],
              resolvePagePlacement: input.resolvePagePlacement,
            }),
          }
        : {}),
    });
    const reconciliation = reconcileOwnedPlacements({
      current: current.placements,
      desired: composed.placements,
      destinations: next.destinations,
      activate: next.activate,
      valuesEqual: input.valuesEqual,
    });
    return {
      ...current,
      pageStates: next.pageStates,
      projectId: next.projectId,
      location: next.location,
      activePageId: next.activePageId,
      activeModeId: next.activeModeId,
      placements: composed.placements,
      reconciliation,
    };
  };
  const location = (
    target: WorkbenchPageLocationCommitInput,
    current: WorkbenchPageRegistryStoreState<Value>,
    owned?: PreparedOwnedPlacements<Value>,
  ) => {
    const pageStates = target.pageStates ?? current.pageStates;
    const page = requirePage(current, target.pageId);
    const resourceKey = (resource: ResourceRef) => pageResourceInstanceKey(page, resource, input.resources);
    const normalizedTarget = {
      ...target,
      pageContext: { page: target.location.page, parent: target.location.parent, params: target.location.params },
      ...(target.resource ? { resource: normalizeResource(target.resource) } : {}),
    };
    const stateKey = pageStateKey(page, target.location, input.resources);
    const currentPageState =
      pageStates[stateKey] ?? input.restorePageState?.(page, target.location, target.projectId) ?? emptyPageState(page);
    const primaryState = target.pageStates
      ? currentPageState
      : selectPrimaryTarget({ page, state: currentPageState, target: normalizedTarget, resourceKey });
    const openFollowers =
      !target.pageStates ||
      current.activePageId !== page.id ||
      pageResourceContextKey(page, current.location?.resource) !==
        pageResourceContextKey(page, normalizedTarget.resource) ||
      (primaryState.activePrimaryInstanceKey !== undefined &&
        current.pageStates[stateKey]?.activePrimaryInstanceKey !== primaryState.activePrimaryInstanceKey);
    const pageState = openFollowers
      ? openPageResourceBindings({ page, state: primaryState, target: normalizedTarget, resourceKey })
      : primaryState;
    const independentLanding = prepareLanding(page, target, owned);
    const prepared = compose(
      current,
      {
        pageStates: { ...pageStates, [stateKey]: pageState },
        projectId: target.projectId,
        location: target.location,
        activePageId: page.id,
        activeModeId: page.modeId,
        activate: [
          ...(independentLanding ? [independentLanding.identity] : []),
          ...(owned?.landing ? [owned.landing] : []),
          ...locationActivations(page, pageState, normalizedTarget, input.resources, openFollowers),
        ],
        action: target.action,
      },
      independentLanding ? { mode: independentLanding.placements } : owned,
    );
    const landingIdentity = independentLanding?.identity ?? owned?.landing;
    if (landingIdentity) input.validateLanding?.(prepared, landingIdentity);
    return prepared;
  };
  const prepareLanding = (
    page: WorkbenchPageContribution,
    target: WorkbenchPageLocationCommitInput,
    owned?: PreparedOwnedPlacements<Value>,
  ) => {
    if (owned || target.pageStates) return undefined;
    return input.resolveLanding?.(page, { projectId: target.projectId, location: target.location, open: target.open });
  };
  const slot = (
    target: WorkbenchPageSlotOpenInput,
    current: WorkbenchPageRegistryStoreState<Value>,
    owned?: PreparedOwnedPlacements<Value>,
  ) => {
    if (current.activePageId !== target.pageId) throw new Error(`Page is not active: ${target.pageId}`);
    const page = requirePage(current, target.pageId);
    const resourceKey = (resource: ResourceRef) => pageResourceInstanceKey(page, resource, input.resources);
    const slot = requirePageSlot(page, target.slotId);
    const stateKey = pageStateKey(page, current.location, input.resources);
    let pageState = current.pageStates[stateKey] ?? emptyPageState(page);
    let instanceKey = staticPageInstanceKey(page, current.location?.resource, input.resources);
    const resource = target.resource ? normalizeResource(target.resource) : undefined;
    if (resource) {
      pageState = openResourceSlot({
        slot,
        state: pageState,
        target: { ...target, resource },
        resourceKey,
      });
      instanceKey = pageState.resourceInstances[slot.id]!.at(-1)!.instanceKey;
    } else {
      if (slot.item.kind === "binding") throw new Error(`Page slot "${slot.id}" requires a resource`);
      if (target.open) throw new Error(`Page slot "${slot.id}" accepts open intent only with a resource`);
      pageState = setStaticSlotOpen(pageState, slot.id, true);
    }
    return compose(
      current,
      {
        ...current,
        pageStates: { ...current.pageStates, [stateKey]: pageState },
        activate: [pagePlacementIdentity(page.id, slot.id, instanceKey)],
        destinations: target.region
          ? [{ identity: pagePlacementIdentity(page.id, slot.id, instanceKey), region: target.region }]
          : undefined,
        action: "openPageSlot",
      },
      owned,
    );
  };
  const restore = (target: WorkbenchPageLocationCommitInput, current: WorkbenchPageRegistryStoreState<Value>) => {
    const page = requirePage(current, target.pageId);
    const state = input.restorePageState?.(page, target.location, target.projectId);
    if (!state) return location(target, current);
    return compose(current, {
      ...current,
      pageStates: { ...current.pageStates, [pageStateKey(page, target.location, input.resources)]: state },
      projectId: target.projectId,
      location: target.location,
      activePageId: page.id,
      activeModeId: page.modeId,
      activate: [],
      action: target.action,
    });
  };
  const selection = (target: WorkbenchPageLocationCommitInput, current: WorkbenchPageRegistryStoreState<Value>) => {
    const page = requirePage(current, target.pageId);
    const context = { modeId: page.modeId, pageId: page.id, projectId: target.projectId, location: target.location };
    const selected = target.resource ? target : { ...target, pageStates: current.pageStates };
    return location(selected, current, {
      shell: input.resolveShellPlacements(context),
      mode: input.resolveModePlacements(page.modeId, target.location, target.projectId, page.id),
    });
  };
  return { compose, location, restore, selection, slot };
};
