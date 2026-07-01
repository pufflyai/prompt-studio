import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchControlsView } from "./controls-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchControlsRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setControlsRendererImplementation(({ workbench: scope, placement, controlsRendererId }) => {
    const contribution = scope.renderers.getControlsRenderer(controlsRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchControlsView, { workbench: scope, contribution, placement });
  });
};
