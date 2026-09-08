import { createElement, lazy, Suspense } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";

const loadWorkbenchFileRendererView = () =>
  import("./file-renderer-view").then((module) => ({
    default: module.WorkbenchFileRendererView,
  }));

const WorkbenchFileRendererView = lazy(loadWorkbenchFileRendererView);

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchFileRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  getWorkbenchRenderers(workbench).setFileRendererImplementation(({ workbench: scope, instance, fileRendererId }) => {
    const contribution = getWorkbenchRenderers(scope).getFileRenderer(fileRendererId);
    if (!contribution) return null;
    return createElement(
      Suspense,
      { fallback: null },
      createElement(WorkbenchFileRendererView, { workbench: scope, contribution, placement: instance }),
    );
  });
};
