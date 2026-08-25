import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchModuleContext } from "../../core";
import {
  panelRendererId,
  registerWorkbenchExtensionPanel,
  toWorkbenchCompositionPanelContribution,
} from "./panel-contributions";
import type { ExtensionTreePanelRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  workbench: WorkbenchModuleContext;
  resourcePanels?: WorkbenchExtensionMetadata["resourcePanels"];
}

export const registerTreeViewWidget = (
  input: RegisterTreeViewWidgetInput,
  panel: ExtensionTreePanelRecord,
  index: number,
  menuDeclarationOffset: number,
) => {
  const rendererId = panelRendererId(panel, "tree");
  if (!rendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: input.workbench,
    path: panel.path,
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      resourcePanels: input.resourcePanels,
    }),
  });
};
