import { preloadCodeEditor } from "@pstdio/ui/diff";
import { createElement, lazy, Suspense } from "react";
import type { WorkbenchCore } from "../../../core";

const loadWorkbenchFileRendererView = () =>
  import("./file-renderer-view").then((module) => ({
    default: module.WorkbenchFileRendererView,
  }));

const WorkbenchFileRendererView = lazy(loadWorkbenchFileRendererView);

if (typeof document !== "undefined") void preloadCodeEditor();

export const createWorkbenchFileRendererInstaller = (preloadView: () => void) => {
  // Track per-core installation so repeated <Workbench> renders are idempotent.
  const installed = new WeakSet<WorkbenchCore>();

  return (workbench: WorkbenchCore) => {
    if (installed.has(workbench)) return;
    installed.add(workbench);
    preloadView();
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
};

export const installWorkbenchFileRenderer = createWorkbenchFileRendererInstaller(() => {
  if (typeof window !== "undefined") void preloadCodeEditor();
  void loadWorkbenchFileRendererView();
});
