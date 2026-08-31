import type { LayoutModel } from "../../registries/layout/layout-model";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { reconcileOwnedWidgetLayout } from "../../registries/layout/owned-placement-layout";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import { activateWorkbenchPageMode } from "../../registries/modes/mode-registry-internals";
import type { WorkbenchPageRegistry, WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";

export interface ConnectWorkbenchPageRuntimeInput {
  layout: LayoutModel;
  modes: WorkbenchModeRegistry;
  registry: WorkbenchPageRegistry<WorkbenchWidgetPlacement>;
}

const applyPageState = (
  input: ConnectWorkbenchPageRuntimeInput,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>,
) => {
  const layout = reconcileOwnedWidgetLayout({
    layout: input.layout.getLayout(),
    placements: state.placements,
    activate: state.reconciliation.activate.map((placement) => placement.identity),
  });
  activateWorkbenchPageMode(input.modes, state.activeModeId);
  input.layout.restoreLayout(layout);
};

export const connectWorkbenchPageRuntime = (input: ConnectWorkbenchPageRuntimeInput) =>
  getWorkbenchPageRegistryInternals(input.registry).connectRuntime((state) => applyPageState(input, state));
