import type { ResourceRef } from "@pstdio/sdk/extensions";
import { createDisposable } from "../../shared/disposable";
import type { InternalWorkbenchStore } from "../../shared/store/workbench-store";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
  reconcileOwnedPlacements,
} from "../layout/placement-reconciliation";
import { validateWorkbenchPage } from "./page-placement-resolver";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
} from "./page-registry-types";
import { emptyPageState } from "./page-slot-lifecycle";

const emptyReconciliation = <Value>(): OwnedPlacementReconciliation<Value> => ({
  add: [],
  retain: [],
  update: [],
  activate: [],
  remove: [],
});

export const registerWorkbenchPage = <Value>(input: {
  page: WorkbenchPageContribution;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  store: InternalWorkbenchStore<WorkbenchPageRegistryStoreState<Value>>;
  normalizeResource(resource: ResourceRef): ResourceRef;
  resourceKey(resource: ResourceRef): string;
}) => {
  const { page, store } = input;
  validateWorkbenchPage(page);
  const current = store.getState();
  if (current.pages[page.id]) throw new Error(`Page already registered: ${page.id}`);
  if (
    Object.values(current.pages).some(
      (candidate) => candidate.ref.extensionId === page.ref.extensionId && candidate.ref.id === page.ref.id,
    )
  ) {
    throw new Error(`Page ref already registered: ${page.ref.extensionId}.${page.ref.id}`);
  }
  if (
    Object.values(current.pages).some(
      (candidate) => candidate.ref.extensionId === page.ref.extensionId && candidate.path === page.path,
    )
  ) {
    throw new Error(`Page route already registered: ${page.ref.extensionId}.${page.path}`);
  }
  const registered = {
    ...page,
    ref: { ...page.ref },
    slots: page.slots.map((slot) => ({
      ...slot,
      ...(slot.defaultResource ? { defaultResource: input.normalizeResource(slot.defaultResource) } : {}),
    })),
  };
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
      const placements = composeOwnedPlacements({ shell: input.registryInput.resolveShellPlacements() }).placements;
      store.setState(
        {
          ...snapshot,
          pages,
          pageStates,
          location: undefined,
          activePageId: undefined,
          activeModeId: undefined,
          placements,
          reconciliation: reconcileOwnedPlacements({
            current: snapshot.placements,
            desired: placements,
            valuesEqual: input.registryInput.valuesEqual,
          }),
        },
        false,
        "unregisterActivePage",
      );
      return;
    }
    store.setState({ ...snapshot, pages, pageStates, reconciliation: emptyReconciliation() }, false, "unregisterPage");
  });
};
