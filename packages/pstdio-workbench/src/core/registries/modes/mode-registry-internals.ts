import type { WorkbenchModeRegistry } from "./mode-registry";

interface WorkbenchModeRegistryInternals {
  activatePageMode(modeId: string | undefined, applyLayout: () => void): void;
}

const modeRegistryInternals = new WeakMap<WorkbenchModeRegistry, WorkbenchModeRegistryInternals>();

export const setWorkbenchModeRegistryInternals = (
  registry: WorkbenchModeRegistry,
  internals: WorkbenchModeRegistryInternals,
) => {
  modeRegistryInternals.set(registry, internals);
};

export const activateWorkbenchPageMode = (
  registry: WorkbenchModeRegistry,
  modeId: string | undefined,
  applyLayout: () => void,
) => {
  const internals = modeRegistryInternals.get(registry);
  if (!internals) throw new Error("Workbench mode registry internals are unavailable");
  internals.activatePageMode(modeId, applyLayout);
};
