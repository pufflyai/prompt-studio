import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { pageLayoutScope } from "./owner-layout-scope";

export const pageOwnerScope = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
  pageLayoutScope(
    { projectId: state.projectId, pageId: state.activePageId, resource: state.location?.resource },
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );

export const preparedOwnerStates = (states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[]) => {
  const owners = new Map<string | undefined, WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>>();
  for (const state of states) {
    const scope = pageOwnerScope(state);
    const previous = owners.get(scope);
    const activation = new Map([
      ...(previous?.reconciliation.activate ?? []).map((p) => [placementIdentityKey(p.identity), p] as const),
      ...state.reconciliation.activate.map((p) => [placementIdentityKey(p.identity), p] as const),
    ]);
    owners.delete(scope);
    owners.set(scope, { ...state, reconciliation: { ...state.reconciliation, activate: [...activation.values()] } });
  }
  return owners;
};
