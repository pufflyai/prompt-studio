import type { LayoutModel } from "../../registries/layout/layout-model-types";
import { createDefaultWorkbenchLayout, type WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { hasPlacementDeclaration } from "../../registries/placements/placement-declaration";
import type { WorkbenchCore } from "../../workbench-core-types";
import { findOtherOwnedResourceEditor } from "../navigation/resource-editor-resolver";
import { ownerLayoutActivation, resolveOwnerPlacements } from "./owner-layout-resolution";
import { pageOwnerScope, preparedOwnerStates } from "./prepared-owner-states";
import type { createWorkbenchLayoutCache } from "./workbench-layout-cache";

export const createPreparedOwnerLayoutSaver =
  (input: {
    cache: ReturnType<typeof createWorkbenchLayoutCache>;
    layout: LayoutModel;
    resolveCore(): WorkbenchCore;
  }) =>
  (states: readonly WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>[]) => {
    const final = states.at(-1);
    if (!final) return;
    const finalScope = pageOwnerScope(final);
    const owners = preparedOwnerStates(states);
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
        existingEditor: (placement, state) => findOtherOwnedResourceEditor(input.resolveCore(), placement, state),
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
