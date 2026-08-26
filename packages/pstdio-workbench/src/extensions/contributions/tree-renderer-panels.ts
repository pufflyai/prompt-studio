import type { WorkbenchModuleContext } from "../../core";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import {
  panelRendererId,
  registerWorkbenchExtensionPanel,
  resolveWorkbenchExtensionViewInput,
  toWorkbenchCompositionPanelContribution,
  type WorkbenchExtensionViewInputResolver,
} from "./panel-contributions";
import type { ExtensionTreePanelRecord } from "./tree-renderer-contribution-types";

interface RegisterTreeViewWidgetInput {
  resourcePanels?: WorkbenchExtensionMetadata["resourcePanels"];
  resolveViewInput?: WorkbenchExtensionViewInputResolver;
  workbench: WorkbenchModuleContext;
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
    aliases: panel.aliases,
    resolveInput: resolveWorkbenchExtensionViewInput(input.resolveViewInput, panel),
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      resourcePanels: input.resourcePanels,
    }),
  });
};
