import { resourceKey } from "@pstdio/sdk/extensions";
import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import { clearCachedResourceContent } from "./file-renderer-load-state";
import { WorkbenchFileRendererView } from "./file-renderer-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchFileRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.resources.onWillRemove((resource) => {
    clearCachedResourceContent(resourceKey(resource));
    return [];
  });
  getWorkbenchRenderers(workbench).setFileRendererImplementation(({ workbench: scope, instance, fileRendererId }) => {
    const contribution = getWorkbenchRenderers(scope).getFileRenderer(fileRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchFileRendererView, { workbench: scope, contribution, placement: instance });
  });
};
