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
import { removePageStates } from "./page-state-key";

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
  publishState(state: WorkbenchPageRegistryStoreState<Value>, action: string): void;
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
    slots: page.slots.map((slot) => ({ ...slot })),
  };
  const placementRegistration = input.registryInput.registerPagePlacements?.(registered);
  store.setState(
    {
      ...current,
      pages: { ...current.pages, [page.id]: registered },
      reconciliation: emptyReconciliation(),
    },
    false,
    "registerPage",
  );
  return createDisposable(() => {
    const snapshot = store.getState();
    if (snapshot.pages[page.id] !== registered) return;
    const { [page.id]: _page, ...pages } = snapshot.pages;
    const pageStates = removePageStates(snapshot.pageStates, page.id);
    if (snapshot.activePageId === page.id) {
      const placements = composeOwnedPlacements({ shell: input.registryInput.resolveShellPlacements() }).placements;
      input.publishState(
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
        "unregisterActivePage",
      );
      placementRegistration?.dispose();
      return;
    }
    store.setState({ ...snapshot, pages, pageStates, reconciliation: emptyReconciliation() }, false, "unregisterPage");
    placementRegistration?.dispose();
  });
};
