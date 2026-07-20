import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContributionContext } from "../../core";
import { resolveWorkbenchViewRegion } from "../shared/workbench-targets";
import type { ExtensionTreeViewRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContributionContext;
}

export const registerTreeViewWidget = (input: RegisterTreeViewWidgetInput, view: ExtensionTreeViewRecord) => {
  if (!view.treeRendererId) return undefined;
  const region = resolveWorkbenchViewRegion(view.target);
  return input.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    region: view.surface === "modal" ? "overlay" : region,
    rendererId: view.treeRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
  });
};
