import { createDisposable } from "../../shared/disposable";
import { composeOwnedPlacements, reconcileOwnedPlacements } from "../layout/placement-reconciliation";
import { resolvePagePlacementClose } from "./page-placement-close";
import { pagePlacementIdentity, resolvePagePlacements } from "./page-placement-resolver";
import { registerWorkbenchPage } from "./page-registration";
import { setWorkbenchPageRegistryInternals, type WorkbenchPageLocationCommitInput } from "./page-registry-internals";
import {
  createPageRegistryStore,
  type PageRegistryCommitInput,
  refreshActiveModePlacements,
  refreshShellPlacements,
  resolveModePlacementSet,
} from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "./page-registry-types";
import {
  emptyPageState,
  openPageResourceBindings,
  openResourceSlot,
  pageResourceBindingSlots,
  primarySlot,
  requirePageSlot,
  selectPrimaryTarget,
  setStaticSlotOpen,
} from "./page-slot-lifecycle";

export type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageOpenInput,
  WorkbenchPagePlacementInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
  WorkbenchPageSlotBinding,
  WorkbenchPageSlotInstance,
  WorkbenchPageSlotOpenInput,
} from "./page-registry-types";

export const createWorkbenchPageRegistry = <Value>(
  input: CreateWorkbenchPageRegistryInput<Value>,
): WorkbenchPageRegistry<Value> => {
  const normalizeResource = (resource: Parameters<WorkbenchPageResourceCodec["normalize"]>[0]) =>
    input.resources.normalize(resource);
  const resourceKey = (resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]) =>
    input.resources.toUri(normalizeResource(resource));
  const store = createPageRegistryStore(input);
  let runtime: ((state: WorkbenchPageRegistryStoreState<Value>) => void) | undefined;
  let publishingState: WorkbenchPageRegistryStoreState<Value> | undefined;

  const publishState = (state: WorkbenchPageRegistryStoreState<Value>, action: string) => {
    const storeBeforeRuntime = store.getState();
    const previousPublishingState = publishingState;
    publishingState = state;
    try {
      runtime?.(state);
    } finally {
      publishingState = previousPublishingState;
    }
    // A layout listener may synchronously commit a panel opened for the new page.
    // That nested commit already includes this state and must not be overwritten.
    if (store.getState() === storeBeforeRuntime) store.setState(state, false, action);
  };

  const requirePage = (pageId: string) => {
    const page = store.getState().pages[pageId];
    if (!page) throw new Error(`Unknown page: ${pageId}`);
    return page;
  };

  const commit = (next: PageRegistryCommitInput<Value>) => {
    const current = publishingState ?? store.getState();
    const page = next.activePageId ? current.pages[next.activePageId] : undefined;
    const pageState = page ? next.pageStates[page.id] : undefined;
    const modePlacements = resolveModePlacementSet({
      current,
      modeId: next.activeModeId,
      desired: next.modePlacements,
      resolveModePlacements: input.resolveModePlacements,
    });
    if (
      next.activeModeId &&
      modePlacements?.some(
        (placement) => placement.identity.kind !== "mode" || placement.identity.modeId !== next.activeModeId,
      )
    ) {
      throw new Error(`Mode placement owner does not match active mode: ${next.activeModeId}`);
    }
    const composed = composeOwnedPlacements({
      shell: input.resolveShellPlacements(),
      ...(modePlacements ? { mode: modePlacements } : {}),
      ...(page && pageState
        ? { page: resolvePagePlacements({ page, state: pageState, resolvePagePlacement: input.resolvePagePlacement }) }
        : {}),
    });
    const reconciliation = reconcileOwnedPlacements({
      current: current.placements,
      desired: composed.placements,
      activate: next.activate,
      valuesEqual: input.valuesEqual,
    });
    publishState(
      {
        ...current,
        pageStates: next.pageStates,
        projectId: next.projectId,
        location: next.location,
        activePageId: next.activePageId,
        activeModeId: next.activeModeId,
        placements: composed.placements,
        reconciliation,
      },
      next.action,
    );
  };

  const activatePageWithStates = (target: WorkbenchPageLocationCommitInput) => {
    const pageStates = target.pageStates ?? store.getState().pageStates;
    const page = requirePage(target.pageId);
    const normalizedTarget = {
      ...target,
      ...(target.resource ? { resource: normalizeResource(target.resource) } : {}),
    };
    const currentPageState = pageStates[page.id] ?? emptyPageState(page);
    const primaryState = selectPrimaryTarget({
      page,
      state: currentPageState,
      target: normalizedTarget,
      resourceKey,
    });
    // A close supplies resolved owner state. Replaying automatic opens would undo that close.
    const pageState = target.pageStates
      ? primaryState
      : openPageResourceBindings({
          page,
          state: primaryState,
          target: normalizedTarget,
          resourceKey,
        });
    const primary = primarySlot(page);
    const instanceKey = pageState.activePrimaryInstanceKey;
    if (!instanceKey) throw new Error(`Page "${page.id}" did not resolve a primary instance`);
    const followers = target.pageStates
      ? []
      : pageResourceBindingSlots(page, normalizedTarget.resource)
          .filter((slot) => slot.region !== primary.region)
          .filter((slot, index, slots) => slots.findIndex((candidate) => candidate.region === slot.region) === index)
          .map((slot) => pagePlacementIdentity(page.id, slot.id, resourceKey(normalizedTarget.resource!)));
    commit({
      pageStates: { ...pageStates, [page.id]: pageState },
      projectId: target.projectId,
      location: target.location,
      activePageId: page.id,
      activeModeId: page.modeId,
      activate: [pagePlacementIdentity(page.id, primary.id, instanceKey), ...followers],
      action: target.action,
    });
  };

  const registry: WorkbenchPageRegistry<Value> = {
    store,

    registerPage(page) {
      return registerWorkbenchPage({
        page,
        registryInput: input,
        store,
        publishState,
        normalizeResource,
        resourceKey,
      });
    },

    getPage(pageId) {
      return store.getState().pages[pageId];
    },

    listPages() {
      return Object.values(store.getState().pages).sort((left, right) => left.id.localeCompare(right.id));
    },

    openSlot(target) {
      const current = store.getState();
      if (current.activePageId !== target.pageId) throw new Error(`Page is not active: ${target.pageId}`);
      const page = requirePage(target.pageId);
      const slot = requirePageSlot(page, target.slotId);
      if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
      let pageState = current.pageStates[page.id] ?? emptyPageState(page);
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
        if (slot.binding) throw new Error(`Page slot "${slot.id}" requires a resource`);
        if (target.open) throw new Error(`Page slot "${slot.id}" accepts open intent only with a resource`);
        if (slot.presence !== "fixed") pageState = setStaticSlotOpen(pageState, slot.id, true);
      }
      commit({
        pageStates: { ...current.pageStates, [page.id]: pageState },
        projectId: current.projectId,
        location: current.location,
        activePageId: page.id,
        activeModeId: page.modeId,
        activate: [pagePlacementIdentity(page.id, slot.id, instanceKey)],
        action: "openPageSlot",
      });
    },
  };

  setWorkbenchPageRegistryInternals(registry, {
    resources: input.resources,
    getPublishingState: () => publishingState ?? store.getState(),
    connectRuntime(apply) {
      if (runtime) throw new Error("Workbench page registry already has a runtime");
      runtime = apply;
      try {
        apply(store.getState());
      } catch (error) {
        runtime = undefined;
        throw error;
      }
      return createDisposable(() => {
        if (runtime === apply) runtime = undefined;
      });
    },
    refreshModePlacements() {
      refreshActiveModePlacements({ state: publishingState ?? store.getState(), registryInput: input, commit });
    },
    refreshShellPlacements() {
      refreshShellPlacements({ state: publishingState ?? store.getState(), commit });
    },
    activateLocation: activatePageWithStates,
    clearProject(projectId) {
      const current = store.getState();
      const placements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
      const pageStates = Object.fromEntries(
        Object.values(current.pages).map((page) => [page.id, emptyPageState(page)]),
      );
      publishState(
        {
          ...current,
          pageStates,
          projectId,
          location: undefined,
          activePageId: undefined,
          activeModeId: undefined,
          placements,
          reconciliation: reconcileOwnedPlacements({
            current: current.placements,
            desired: placements,
            valuesEqual: input.valuesEqual,
          }),
        },
        "clearPageProject",
      );
    },
    resolveClosePlacement(identity) {
      const current = store.getState();
      if (identity.kind !== "page") throw new Error("Page registry can close only page-owned placements");
      return resolvePagePlacementClose({
        identity,
        page: requirePage(identity.pageId),
        state: current,
        resourceKey,
      });
    },
  });

  return registry;
};
