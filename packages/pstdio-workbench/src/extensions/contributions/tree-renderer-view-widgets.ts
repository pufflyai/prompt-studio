import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContributionContext } from "../../core";
import { resolveWorkbenchViewWidgetPlacement } from "../shared/workbench-targets";
import type { ExtensionTreeViewRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContributionContext;
}

export const registerTreeViewWidget = (
  input: RegisterTreeViewWidgetInput,
  view: ExtensionTreeViewRecord,
  views: ExtensionTreeViewRecord[],
) => {
  if (!view.treeRendererId) return undefined;
  const placement = resolveWorkbenchViewWidgetPlacement(view, views);
  return input.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    area: placement.area,
    rendererId: view.treeRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
    menu: placement.menu,
  });
};
