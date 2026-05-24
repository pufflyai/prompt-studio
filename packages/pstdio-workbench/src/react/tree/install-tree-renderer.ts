import { createElement } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchTreeView } from "./tree-view";

export interface InstallWorkbenchTreeRendererOptions {
  // Hosts (e.g., the dashboard) supply a per-tree storage key to enable
  // user-customization (visibility + order). Return undefined to leave a tree
  // non-customizable on the host side.
  resolveVisibilityKey?: (treeId: string) => string | undefined;
}

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchTreeRenderer = (
  workbench: WorkbenchCore,
  options: InstallWorkbenchTreeRendererOptions = {},
) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setTreeRendererImplementation(({ workbench: scope, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      visibilityStorageKey: options.resolveVisibilityKey?.(treeId),
    }),
  );
};
