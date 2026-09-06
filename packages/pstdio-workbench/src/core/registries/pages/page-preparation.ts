import { resourceKey as resourceIdentity } from "@pstdio/sdk/extensions";
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
  WorkbenchPageRegistryStoreState,
  WorkbenchPageSlotOpenInput,
} from "./page-registry-types";
import {
  emptyPageState,
  openPageResourceBindings,
  openResourceSlot,
  primarySlot,
  requirePageSlot,
  selectPrimaryTarget,
  setStaticSlotOpen,
} from "./page-slot-lifecycle";
import { pageStateKey } from "./page-state-key";

export interface PreparedOwnedPlacements<Value> {
  shell: readonly ResolvedOwnedPlacement<Value>[];
  mode: readonly ResolvedOwnedPlacement<Value>[];
}
export const createPagePreparation = <Value>(input: CreateWorkbenchPageRegistryInput<Value>) => {
  const normalizeResource = input.resources.normalize;
  const resourceKey = (resource: Parameters<typeof normalizeResource>[0]) =>
    input.resources.toUri(normalizeResource(resource));
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
      resourceIdentity(current.location?.resource) !== resourceIdentity(normalizedTarget.resource) ||
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
        activeModeId: page.modeId,
        activate: [
          ...(primary && instanceKey ? [pagePlacementIdentity(page.id, primary.id, instanceKey)] : []),
          ...followers,
        ],
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
    const slot = requirePageSlot(page, target.slotId);
    if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
    const stateKey = pageStateKey(page, current.location, input.resources);
    let pageState = current.pageStates[stateKey] ?? emptyPageState(page);
    let instanceKey = "default";
    const resource = target.resource ? normalizeResource(target.resource) : undefined;
    if (resource) {
      instanceKey = resourceKey(resource);
      pageState = openResourceSlot({
        slot,
        state: pageState,
        target: { ...target, resource },
        resourceKey: () => instanceKey,
      });
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
        action: "openPageSlot",
      },
      owned,
    );
  };
  return { compose, location, slot };
};
