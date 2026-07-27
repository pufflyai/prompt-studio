import { createElement, lazy, Suspense } from "react";
import type { WorkbenchCore } from "../../../core";

const WorkbenchFileRendererView = lazy(() =>
  import("./file-renderer-view").then((module) => ({
    default: module.WorkbenchFileRendererView,
  })),
);

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchFileRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setFileRendererImplementation(({ workbench: scope, instance, fileRendererId }) => {
    const contribution = scope.renderers.getFileRenderer(fileRendererId);
    if (!contribution) return null;
    return createElement(
      Suspense,
      { fallback: null },
      createElement(WorkbenchFileRendererView, { workbench: scope, contribution, placement: instance }),
    );
  });
};
