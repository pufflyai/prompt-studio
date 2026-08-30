import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
  placementIdentityKey,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { pagePlacementIdentity, resolvePagePlacements, validateWorkbenchPage } from "./page-placement-resolver";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageOpenInput,
  WorkbenchPageRegistry,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import {
  closePageSlot,
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
  ) => {
    const page = requirePage(target.pageId);
    const currentPageState = pageStates[page.id] ?? emptyPageState(page, input.resourceKey);
    const pageState = selectPrimaryTarget({
      page,
      state: currentPageState,
      target,
      resourceKey: input.resourceKey,
    });
    const primary = primarySlot(page);
    const instanceKey = pageState.activePrimaryInstanceKey;
    if (!instanceKey) throw new Error(`Page "${page.id}" did not resolve a primary instance`);
    commit({
      pageStates: { ...pageStates, [page.id]: pageState },
      activePageId: page.id,
      activeModeId: page.modeId,
      activate: [pagePlacementIdentity(page.id, primary.id, instanceKey)],
      action,
    });
  };

  return {
    store,

    registerPage(page) {
      validateWorkbenchPage(page);
      const current = store.getState();
      if (current.pages[page.id]) throw new Error(`Page already registered: ${page.id}`);
      const registered = { ...page, slots: [...page.slots] };
      store.setState(
        {
          ...current,
          pages: { ...current.pages, [page.id]: registered },
          pageStates: { ...current.pageStates, [page.id]: emptyPageState(registered, input.resourceKey) },
          reconciliation: emptyReconciliation(),
        },
        false,
        "registerPage",
      );
      return createDisposable(() => {
        const snapshot = store.getState();
        if (snapshot.pages[page.id] !== registered) return;
        const { [page.id]: _page, ...pages } = snapshot.pages;
        const { [page.id]: _pageState, ...pageStates } = snapshot.pageStates;
        if (snapshot.activePageId === page.id) {
          const placements = composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements;
          store.setState(
            {
              ...snapshot,
              pages,
              pageStates,
              activePageId: undefined,
              activeModeId: undefined,
              placements,
              reconciliation: reconcileOwnedPlacements({
                current: snapshot.placements,
                desired: placements,
                valuesEqual: input.valuesEqual,
              }),
            },
            false,
            "unregisterActivePage",
          );
          return;
        }
        store.setState(
          { ...snapshot, pages, pageStates, reconciliation: emptyReconciliation() },
          false,
          "unregisterPage",
        );
      });
    },

    getPage(pageId) {
      return store.getState().pages[pageId];
    },

    listPages() {
      return Object.values(store.getState().pages).sort((left, right) => left.id.localeCompare(right.id));
    },

    activatePage(target) {
      activatePageWithStates(target, store.getState().pageStates, "activatePage");
    },

    openSlot(target) {
      const current = store.getState();
      if (current.activePageId !== target.pageId) throw new Error(`Page is not active: ${target.pageId}`);
      const page = requirePage(target.pageId);
      const slot = requirePageSlot(page, target.slotId);
      if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
      let pageState = current.pageStates[page.id] ?? emptyPageState(page, input.resourceKey);
      let instanceKey = "default";
      const resource = target.resource ?? slot.defaultResource;
      if (resource) {
        instanceKey = input.resourceKey(resource);
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
        activePageId: page.id,
        activeModeId: page.modeId,
        activate: [pagePlacementIdentity(page.id, slot.id, instanceKey)],
        action: "openPageSlot",
      });
    },

    closePlacement(identity) {
      if (identity.kind !== "page") throw new Error("Page registry can close only page-owned placements");
      const current = store.getState();
      if (current.activePageId !== identity.pageId) throw new Error(`Page is not active: ${identity.pageId}`);
      const page = requirePage(identity.pageId);
      const slot = requirePageSlot(page, identity.slotId);
      const exists = current.placements.some(
        (candidate) => placementIdentityKey(candidate.identity) === placementIdentityKey(identity),
      );
      if (!exists) throw new Error(`Page placement is not open: ${placementIdentityKey(identity)}`);
      if (slot.role === "primary" && identity.instanceKey === "default") {
        throw new Error(`Static primary placement is not closable: ${page.id}.${slot.id}`);
      }
      if (!slot.closable) throw new Error(`Page placement is not closable: ${page.id}.${slot.id}`);

      const pageState = current.pageStates[page.id] ?? emptyPageState(page, input.resourceKey);
      const result = closePageSlot({ page, slot, state: pageState, instanceKey: identity.instanceKey });
      const pageStates = { ...current.pageStates, [page.id]: result.state };
      if (result.kind === "parent") {
        activatePageWithStates({ pageId: result.parentId }, pageStates, "closePagePlacementToParent");
        return;
      }
      commit({
        pageStates,
        activePageId: page.id,
        activeModeId: page.modeId,
        activate: result.activateInstanceKey
          ? [pagePlacementIdentity(page.id, slot.id, result.activateInstanceKey)]
          : undefined,
        action: result.activateInstanceKey === "default" ? "closePagePlacementToDefault" : "closePagePlacement",
      });
    },
  };
};
