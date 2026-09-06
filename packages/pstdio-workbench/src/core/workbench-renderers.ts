import type { WorkbenchCore, WorkbenchRenderers } from "./workbench-core-types";

const renderersByWorkbench = new WeakMap<WorkbenchCore, WorkbenchRenderers>();

export const setWorkbenchRenderers = (workbench: WorkbenchCore, renderers: WorkbenchRenderers) => {
  renderersByWorkbench.set(workbench, renderers);
};

export const getWorkbenchRenderers = (workbench: WorkbenchCore) => {
  const renderers = renderersByWorkbench.get(workbench);
  if (!renderers) throw new Error("Workbench renderers are not initialized");
  return renderers;
};
