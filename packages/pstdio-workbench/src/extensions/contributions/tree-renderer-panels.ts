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
  pages?: WorkbenchExtensionMetadata["pages"];
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
    resolveInput: resolveWorkbenchExtensionViewInput(input.resolveViewInput, panel),
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      pages: input.pages,
    }),
  });
};
