import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContributionContext } from "../../core";
import { resolveWorkbenchViewRegion } from "../shared/workbench-targets";
import type { ExtensionTreeViewRecord } from "./tree-renderer-contribution-types";
import { registerWorkbenchExtensionViewWidget } from "./view-widget-contributions";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContributionContext;
}

export const registerTreeViewWidget = (input: RegisterTreeViewWidgetInput, view: ExtensionTreeViewRecord) => {
  if (!view.treeRendererId) return undefined;
  const region = resolveWorkbenchViewRegion(view.target);
  return registerWorkbenchExtensionViewWidget({
    workbench: input.workbench,
    role: view.role,
    contribution: {
      id: view.id,
      title: text(view.title, view.id),
      region,
      rendererId: view.treeRendererId,
      singleton: true,
      resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
      eligibleLocations: view.resourceKind ? { resourceKinds: [view.resourceKind] } : undefined,
      panelMenuOwner: view.panelMenuOwner,
    },
  });
};
