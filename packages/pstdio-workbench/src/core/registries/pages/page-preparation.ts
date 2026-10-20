import type { ResourceRef } from "@pstdio/sdk/extensions";
import {
  composeOwnedPlacements,
  type ResolvedOwnedPlacement,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { resolvePageMode } from "./page-availability";
import { pageFollowerIdentities, pagePlacementIdentity, resolvePagePlacements } from "./page-placement-resolver";
import type { WorkbenchPageLocationCommitInput } from "./page-registry-internals";
import { type PageRegistryCommitInput, resolveModePlacementSet } from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageRegistryStoreState,
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
  shell: readonly ResolvedOwnedPlacement<Value>[];
  mode: readonly ResolvedOwnedPlacement<Value>[];
}
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
      activate: input.prepareState
        ? next.activate?.filter((identity) =>
            composed.placements.some((entry) => JSON.stringify(entry.identity) === JSON.stringify(identity)),
          )
        : next.activate,
      valuesEqual: input.valuesEqual,
    });
    const state = {
      ...current,
      pageStates: next.pageStates,
      projectId: next.projectId,
      location: next.location,
      activePageId: next.activePageId,
      activeModeId: next.activeModeId,
      placements: composed.placements,
      reconciliation,
    };
    return input.prepareState?.(state, current, next.activate, next.editorOpens) ?? state;
  };
  const location = (
    target: WorkbenchPageLocationCommitInput,
    current: WorkbenchPageRegistryStoreState<Value>,
    owned?: PreparedOwnedPlacements<Value>,
  ) => {
    const pageStates = target.pageStates ?? current.pageStates;
    const page = requirePage(current, target.pageId);
    const modeId = resolvePageMode(page, target.location.mode, current.activeModeId);
    const resourceKey = (resource: ResourceRef) => pageResourceInstanceKey(page, resource, input.resources);
    const normalizedTarget = {
      ...target,
      ...(target.resource ? { resource: normalizeResource(target.resource) } : {}),
    };
    const stateKey = pageStateKey(page, target.location, input.resources);
    const currentPageState =
      pageStates[stateKey] ?? input.restorePageState?.(page, target.location, target.projectId) ?? emptyPageState(page);
    const primaryState = selectPrimaryTarget({ page, state: currentPageState, target: normalizedTarget, resourceKey });
    const openFollowers =
      !target.pageStates ||
      current.activePageId !== page.id ||
      pageResourceContextKey(page, current.location?.resource) !==
        pageResourceContextKey(page, normalizedTarget.resource) ||
      current.pageStates[stateKey]?.activePrimaryInstanceKey !== primaryState.activePrimaryInstanceKey;
    const pageState = openFollowers
      ? openPageResourceBindings({ page, state: primaryState, target: normalizedTarget, resourceKey })
      : primaryState;
    const primary = primarySlot(page);
    const instanceKey = pageState.activePrimaryInstanceKey;
    const followers = openFollowers ? pageFollowerIdentities(page, normalizedTarget.resource, resourceKey) : [];
    return compose(
      current,
      {
        pageStates: { ...pageStates, [stateKey]: pageState },
        projectId: target.projectId,
        location: target.location,
        activePageId: page.id,
        activeModeId: modeId,
        activate: target.activate ?? [
          ...(primary && instanceKey ? [pagePlacementIdentity(page.id, primary.id, instanceKey)] : []),
          ...followers,
        ],
        editorOpens: target.editorOpens,
        action: target.action,
      },
      owned,
    );
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
    if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
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
      if (slot.item.presence !== "fixed") pageState = setStaticSlotOpen(pageState, slot.id, true);
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
      activeModeId: resolvePageMode(page, target.location.mode, current.activeModeId),
      activate: target.activate ?? [],
      editorOpens: target.editorOpens,
      action: target.action,
    });
  };
  return { compose, location, restore, slot };
};
