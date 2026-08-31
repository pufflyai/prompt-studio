import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  emptyWorkbenchPlacementState,
  getWorkbenchPlacementOwnerState,
  type WorkbenchPlacementState,
} from "../layout/owned-placement-state";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
  type ResolvedOwnedPlacement,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { closeWorkbenchPanelPlacement } from "./page-panel-close";
import { resolvePagePlacementClose } from "./page-placement-close";
import { resolvePagePlacements } from "./page-placement-resolver";
import { loadWorkbenchPlacementState, restoreWorkbenchPageStates } from "./page-placement-state";
import { registerWorkbenchPage } from "./page-registration";
import { setWorkbenchPageRegistryInternals } from "./page-registry-internals";
import { snapshotOwnerPlacementStates } from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryCommitInput,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "./page-registry-types";
import { openWorkbenchPanelTargetBatch, resolveWorkbenchPageLocationTarget } from "./page-target-batch";

export type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchModePanelTargetInput,
  WorkbenchModePanelTargetResolution,
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
} from "./page-registry-types";

const emptyReconciliation = <Value>(): OwnedPlacementReconciliation<Value> => ({
  add: [],
  retain: [],
  update: [],
  activate: [],
  remove: [],
});

const refreshActiveModePlacements = <Value>(input: {
  state: WorkbenchPageRegistryStoreState<Value>;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  reconcileDeclarations(next: WorkbenchPageRegistryCommitInput<Value>): void;
}) => {
  const modeId = input.state.activeModeId;
  if (!modeId) return;
  const current = input.state.placements.filter(
    (placement) => placement.identity.kind === "mode" && placement.identity.modeId === modeId,
  );
  const ownerState = getWorkbenchPlacementOwnerState(input.state.placementState, { kind: "mode", modeId });
  input.reconcileDeclarations({
    pageStates: input.state.pageStates,
    projectId: input.state.projectId,
    location: input.state.location,
    activePageId: input.state.activePageId,
    activeModeId: modeId,
    modePlacements: input.registryInput.resolveModePlacements(modeId, current, ownerState),
    action: "refreshModePlacements",
  });
};

const requireWorkbenchPage = (pages: WorkbenchPageRegistryStoreState<unknown>["pages"], pageId: string) => {
  const page = pages[pageId];
  if (!page) throw new Error(`Unknown page: ${pageId}`);
  return page;
};

const createPageRegistryStore = <Value>(input: CreateWorkbenchPageRegistryInput<Value>) => {
  const placements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
  return createWorkbenchStore<WorkbenchPageRegistryStoreState<Value>>({
    name: "workbench.pages",
    initialState: {
      pages: {},
      pageStates: {},
      placementState: emptyWorkbenchPlacementState(),
      placements,
      reconciliation: emptyReconciliation(),
    },
  });
};

export const createWorkbenchPageRegistry = <Value>(
  input: CreateWorkbenchPageRegistryInput<Value>,
): WorkbenchPageRegistry<Value> => {
  const normalizeResource = (resource: Parameters<WorkbenchPageResourceCodec["normalize"]>[0]) =>
    input.resources.normalize(resource);
  const resourceKey = (resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]) =>
    input.resources.toUri(normalizeResource(resource));
  const store = createPageRegistryStore(input);
  let runtime: ((state: WorkbenchPageRegistryStoreState<Value>) => void) | undefined;

  const publishState = (state: WorkbenchPageRegistryStoreState<Value>, action: string) => {
    runtime?.(state);
    store.setState(state, false, action);
  };

  const resolveModePlacementSet = (
    current: WorkbenchPageRegistryStoreState<Value>,
    modeId: string | undefined,
    desired: readonly ResolvedOwnedPlacement<Value>[] | undefined,
    placementState: WorkbenchPlacementState,
    projectId: string | undefined,
  ) => {
    if (!modeId) return undefined;
    if (desired) return desired;
    const active = current.placements.filter(
      (placement) => placement.identity.kind === "mode" && placement.identity.modeId === modeId,
    );
    if (modeId === current.activeModeId && projectId === current.projectId) return active;
    const ownerState = getWorkbenchPlacementOwnerState(placementState, { kind: "mode", modeId });
    return input.resolveModePlacements(modeId, [], ownerState);
  };

  const applyCommit = (
    next: WorkbenchPageRegistryCommitInput<Value>,
    stateChange: "owner-state" | "declarations-only",
  ) => {
    const current = store.getState();
    let placementState = next.placementState ?? current.placementState;
    const page = next.activePageId ? current.pages[next.activePageId] : undefined;
    const pageState = page ? next.pageStates[page.id] : undefined;
    const modePlacements = resolveModePlacementSet(
      current,
      next.activeModeId,
      next.modePlacements,
      placementState,
      next.projectId,
    );
    if (
      next.activeModeId &&
      modePlacements?.some(
        (placement) => placement.identity.kind !== "mode" || placement.identity.modeId !== next.activeModeId,
      )
    ) {
      throw new Error(`Mode placement owner does not match active mode: ${next.activeModeId}`);
    }
    if (stateChange === "owner-state") {
      placementState = snapshotOwnerPlacementStates({
        state: placementState,
        page,
        pageState,
        modeId: next.activeModeId,
        modePlacements,
        resolveModePlacementState: input.resolveModePlacementState,
      });
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
        placementState,
        placements: composed.placements,
        reconciliation,
      },
      next.action,
    );
    if (next.projectId) input.placementStatePersistence?.save(next.projectId, placementState);
  };

  const commit = (next: WorkbenchPageRegistryCommitInput<Value>) => applyCommit(next, "owner-state");
  const reconcileDeclarations = (next: WorkbenchPageRegistryCommitInput<Value>) =>
    applyCommit(next, "declarations-only");

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
  };

  setWorkbenchPageRegistryInternals(registry, {
    resources: input.resources,
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
    openPanel(target) {
      const current = store.getState();
      return openWorkbenchPanelTargetBatch({
        targets: [target],
        registryInput: input,
        state: current,
        normalizeResource,
        resourceKey,
        commit,
      })[0]!;
    },
    openPanels(targets) {
      if (targets.length === 0) return [];
      const current = store.getState();
      return openWorkbenchPanelTargetBatch({
        targets,
        registryInput: input,
        state: current,
        normalizeResource,
        resourceKey,
        commit,
      });
    },
    closePanel(identity) {
      closeWorkbenchPanelPlacement({
        identity,
        registryInput: input,
        state: store.getState(),
        requirePage: (pageId) => requireWorkbenchPage(store.getState().pages, pageId),
        resourceKey,
        commit,
      });
    },
    refreshModePlacements() {
      refreshActiveModePlacements({ state: store.getState(), registryInput: input, reconcileDeclarations });
    },
    activateLocation(target) {
      const current = store.getState();
      const page = requireWorkbenchPage(current.pages, target.pageId);
      const next = resolveWorkbenchPageLocationTarget({
        target,
        page,
        current,
        registryInput: input,
        resolveModePlacements: (placementState) =>
          resolveModePlacementSet(current, page.modeId, undefined, placementState, target.projectId),
        normalizeResource,
        resourceKey,
      });
      commit(next);
      return next.activate ?? [];
    },
    clearProject(projectId) {
      const current = store.getState();
      const placements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
      const placementState = loadWorkbenchPlacementState(input.placementStatePersistence, projectId);
      const pageStates = restoreWorkbenchPageStates(current.pages, placementState, resourceKey);
      publishState(
        {
          ...current,
          pageStates,
          projectId,
          location: undefined,
          activePageId: undefined,
          activeModeId: undefined,
          placementState,
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
        page: requireWorkbenchPage(current.pages, identity.pageId),
        state: current,
        resourceKey,
      });
    },
  });

  return registry;
};
