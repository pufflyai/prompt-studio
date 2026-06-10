import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchFileRendererView } from "./file-renderer-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchFileRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setFileRendererImplementation(({ workbench: scope, placement, fileRendererId }) => {
    const contribution = scope.renderers.getFileRenderer(fileRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchFileRendererView, { workbench: scope, contribution, placement });
  });
};
