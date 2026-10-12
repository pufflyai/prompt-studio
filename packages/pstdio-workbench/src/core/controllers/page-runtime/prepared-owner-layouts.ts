import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { hasPlacementDeclaration } from "../../registries/placements/placement-declaration";
import type { WorkbenchCore } from "../../workbench-core-types";
import { ownerLayoutActivation, resolveOwnerPlacements } from "./owner-layout-resolution";
import { pageLayoutScope } from "./owner-layout-scope";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

const scopeFor = (state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>) =>
  pageLayoutScope(
    { projectId: state.projectId, pageId: state.activePageId, resource: state.location?.resource },
    state.activePageId ? state.pages[state.activePageId] : undefined,
  );

const stagedOwnerStates = (states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[]) => {
  const owners = new Map<string | undefined, WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>>();
  for (const state of states) {
    const scope = scopeFor(state);
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

export const createPreparedOwnerLayoutSaver =
  (input: {
    cache: ReturnType<typeof createWorkbenchLayoutCache>;
    layout: LayoutModel;
    resolveCore(): Pick<WorkbenchCore, "pages" | "modePlacements" | "shellPlacements">;
  }) =>
  (states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[]) => {
    const final = states.at(-1);
    if (!final) return;
    const finalScope = scopeFor(final);
    const owners = stagedOwnerStates(states);
    for (const [scope, state] of owners) {
      if (!state.activePageId || !state.activeModeId) continue;
      if (scope === finalScope) continue;
      const pageLayout = input.cache.layout.getLayout(scope);
      const modeLayout = input.cache.readMode(state.projectId, state.activeModeId);
      const placements = resolveOwnerPlacements({
        state,
        pageLayout,
        modeLayout,
        enteringPage: true,
        getWidget: input.layout.getWidget,
        hasDeclaration: (identity) => hasPlacementDeclaration(input.resolveCore(), identity),
      });
      const layout = reconcileOwnedWidgetLayout({
        layout: pageLayout ?? createDefaultWorkbenchLayout(),
        modeLayout,
        placements,
        activate: ownerLayoutActivation(state.reconciliation.activate, placements).map((p) => p.identity),
      });
      input.cache.layout.setLayout(layout, scope);
      if (state.activeModeId !== final.activeModeId) input.cache.saveMode(state.projectId, state.activeModeId, layout);
    }
  };
