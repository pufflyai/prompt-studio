import { validatePageParamDefinitions } from "pstdio-api-contracts";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { createDisposable } from "../../shared/disposable";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { composeOwnedPlacements, reconcileOwnedPlacements } from "../layout/placement-reconciliation";
import { resolvePagePlacementClose } from "./page-placement-close";
import { pinPagePlacement } from "./page-placement-pin";
import { createPagePreparation } from "./page-preparation";
import { registerWorkbenchPage } from "./page-registration";
import { setWorkbenchPageRegistryInternals, type WorkbenchPageLocationCommitInput } from "./page-registry-internals";
import {
  createPageRegistryStore,
  type PageRegistryCommitInput,
  refreshActiveModePlacements,
  refreshShellPlacements,
} from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
} from "./page-registry-types";
import { refreshPageResources, refreshResourceLocation } from "./page-resource-refresh";
import { pageStateKey } from "./page-state-key";

export type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageMain,
  WorkbenchPageOpenInput,
  WorkbenchPagePlacementInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
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
  let normalizeState:
    | ((state: WorkbenchPageRegistryStoreState<Value>) => WorkbenchPageRegistryStoreState<Value>)
    | undefined;
  let publishingState: WorkbenchPageRegistryStoreState<Value> | undefined;

  const publishState = (state: WorkbenchPageRegistryStoreState<Value>, action: string) =>
    batchWorkbenchChanges(() => {
      state = normalizeState?.(state) ?? state;
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
    });

  const requirePage = (pageId: string) => {
    const page = store.getState().pages[pageId];
    if (!page) throw new Error(`Unknown page: ${pageId}`);
    return page;
  };

  const prepare = createPagePreparation(input);
  const commit = (next: PageRegistryCommitInput<Value>) =>
    publishState(prepare.compose(publishingState ?? store.getState(), next), next.action);
  const activatePageWithStates = (target: WorkbenchPageLocationCommitInput) =>
    publishState(prepare.location(target, store.getState()), target.action);

  const registry: WorkbenchPageRegistry<Value> = {
    store,

    registerPage(page) {
      validatePageParamDefinitions(page.params);
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

    resourceReferenceKey(resource) {
      const normalized = normalizeResource(resource);
      const keys = new Set(
        Object.values(store.getState().pages).flatMap((page) =>
          page.document && page.resource && resourceMatchesConstraint(page.resource, normalized)
            ? [page.document.metadataKey]
            : [],
        ),
      );
      return JSON.stringify([
        resourceKey(normalized),
        [...keys].sort().map((key) => [key, normalized.metadata?.[key] ?? null]),
      ]);
    },

    refreshResource(resource) {
      const state = store.getState();
      commit({
        ...state,
        location: refreshResourceLocation(state.location, resource, registry.resourceReferenceKey),
        pageStates: refreshPageResources(state.pageStates, resource, registry.resourceReferenceKey),
        action: "refreshPageResource",
      });
    },

    pinPlacement(identity, open) {
      commit({ ...pinPagePlacement(store.getState(), identity, input.resources, open), action: "pinPagePlacement" });
    },

    openSlot(target) {
      publishState(prepare.slot(target, store.getState()), "openPageSlot");
    },
  };

  setWorkbenchPageRegistryInternals(registry, {
    resources: input.resources,
    prepare,
    publish: publishState,
    onDidCommit: (listener) => createDisposable(store.api.subscribe(listener)),
    getPublishingState: () => publishingState ?? store.getState(),
    connectRuntime(apply, normalize) {
      if (runtime) throw new Error("Workbench page registry already has a runtime");
      runtime = apply;
      normalizeState = normalize;
      try {
        publishState(store.getState(), "connectPageRuntime");
      } catch (error) {
        runtime = undefined;
        normalizeState = undefined;
        throw error;
      }
      return createDisposable(() => {
        if (runtime === apply) {
          runtime = undefined;
          normalizeState = undefined;
        }
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
      const pageStates = {};
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
        stateKey: pageStateKey(requirePage(identity.pageId), current.location, input.resources),
        resourceKey,
      });
    },
  });

  return registry;
};
