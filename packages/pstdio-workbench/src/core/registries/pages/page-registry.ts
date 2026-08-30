import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
  type ResolvedOwnedPlacement,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { resolvePagePlacementClose } from "./page-placement-close";
import { pagePlacementIdentity, resolvePagePlacements } from "./page-placement-resolver";
import { registerWorkbenchPage } from "./page-registration";
import { setWorkbenchPageRegistryInternals } from "./page-registry-internals";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageOpenInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import { emptyPageState, primarySlot, selectPrimaryTarget } from "./page-slot-lifecycle";
import { openWorkbenchPanelTarget } from "./panel-target-opening";

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

export const createWorkbenchPageRegistry = <Value>(
  input: CreateWorkbenchPageRegistryInput<Value>,
): WorkbenchPageRegistry<Value> => {
  const normalizeResource = (resource: Parameters<WorkbenchPageResourceCodec["normalize"]>[0]) =>
    input.resources.normalize(resource);
  const resourceKey = (resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]) =>
    input.resources.toUri(normalizeResource(resource));
  const initialPlacements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
  const store = createWorkbenchStore<WorkbenchPageRegistryStoreState<Value>>({
    name: "workbench.pages",
    initialState: {
      pages: {},
      pageStates: {},
      placements: initialPlacements,
      reconciliation: emptyReconciliation(),
    },
  });

  const requirePage = (pageId: string) => {
    const page = store.getState().pages[pageId];
    if (!page) throw new Error(`Unknown page: ${pageId}`);
    return page;
  };

  const resolveModePlacementSet = (
    current: WorkbenchPageRegistryStoreState<Value>,
    modeId: string | undefined,
    desired: readonly ResolvedOwnedPlacement<Value>[] | undefined,
  ) => {
    if (!modeId) return undefined;
    if (desired) return desired;
    if (modeId !== current.activeModeId) return input.resolveModePlacements(modeId);
    return current.placements.filter(
      (placement) => placement.identity.kind === "mode" && placement.identity.modeId === modeId,
    );
  };

  const commit = (next: {
    pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
    projectId?: string;
    location?: WorkbenchPageRegistryStoreState<Value>["location"];
    activePageId?: string;
    activeModeId?: string;
    modePlacements?: readonly ResolvedOwnedPlacement<Value>[];
    activate?: readonly PlacementIdentity[];
    action: string;
  }) => {
    const current = store.getState();
    const page = next.activePageId ? current.pages[next.activePageId] : undefined;
    const pageState = page ? next.pageStates[page.id] : undefined;
    const modePlacements = resolveModePlacementSet(current, next.activeModeId, next.modePlacements);
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
    store.setState(
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
      false,
      next.action,
    );
  };

  const activatePageWithStates = (
    target: WorkbenchPageOpenInput,
    pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>,
    action: string,
    locationState: Pick<WorkbenchPageRegistryStoreState<Value>, "projectId" | "location"> = store.getState(),
  ) => {
    const page = requirePage(target.pageId);
    const normalizedTarget = {
      ...target,
      ...(target.resource ? { resource: normalizeResource(target.resource) } : {}),
    };
    const currentPageState = pageStates[page.id] ?? emptyPageState(page, resourceKey);
    const pageState = selectPrimaryTarget({
      page,
      state: currentPageState,
      target: normalizedTarget,
      resourceKey,
    });
    const primary = primarySlot(page);
    const instanceKey = pageState.activePrimaryInstanceKey;
    if (!instanceKey) throw new Error(`Page "${page.id}" did not resolve a primary instance`);
    commit({
      pageStates: { ...pageStates, [page.id]: pageState },
      projectId: locationState.projectId,
      location: locationState.location,
      activePageId: page.id,
      activeModeId: page.modeId,
      activate: [pagePlacementIdentity(page.id, primary.id, instanceKey)],
      action,
    });
  };

  const registry: WorkbenchPageRegistry<Value> = {
    store,

    registerPage(page) {
      return registerWorkbenchPage({
        page,
        registryInput: input,
        store,
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
    openPanel(target) {
      const current = store.getState();
      return openWorkbenchPanelTarget({
        target,
        registryInput: input,
        state: current,
        normalizeResource,
        resourceKey,
        commit: (change) =>
          commit({
            pageStates: change.pageStates,
            projectId: current.projectId,
            location: current.location,
            activePageId: current.activePageId,
            activeModeId: current.activeModeId,
            ...(change.modePlacements ? { modePlacements: change.modePlacements } : {}),
            activate: [change.identity],
            action: change.action,
          }),
      });
    },
    activateLocation(target) {
      activatePageWithStates(target, target.pageStates ?? store.getState().pageStates, target.action, {
        projectId: target.projectId,
        location: target.location,
      });
    },
    clearProject(projectId) {
      const current = store.getState();
      const placements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
      const pageStates = Object.fromEntries(
        Object.values(current.pages).map((page) => [page.id, emptyPageState(page, resourceKey)]),
      );
      store.setState(
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
        false,
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
