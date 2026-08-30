import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
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
import {
  emptyPageState,
  openResourceSlot,
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

  const commit = (next: {
    pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
    projectId?: string;
    location?: WorkbenchPageRegistryStoreState<Value>["location"];
    activePageId?: string;
    activeModeId?: string;
    activate?: readonly PlacementIdentity[];
    action: string;
  }) => {
    const current = store.getState();
    const page = next.activePageId ? current.pages[next.activePageId] : undefined;
    const pageState = page ? next.pageStates[page.id] : undefined;
    const modePlacements = next.activeModeId ? input.resolveModePlacements(next.activeModeId) : undefined;
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

    openSlot(target) {
      const current = store.getState();
      if (current.activePageId !== target.pageId) throw new Error(`Page is not active: ${target.pageId}`);
      const page = requirePage(target.pageId);
      const slot = requirePageSlot(page, target.slotId);
      if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
      let pageState = current.pageStates[page.id] ?? emptyPageState(page, resourceKey);
      let instanceKey = "default";
      const resource = target.resource ? normalizeResource(target.resource) : slot.defaultResource;
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
        pageState = setStaticSlotOpen(pageState, slot.id, true);
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
