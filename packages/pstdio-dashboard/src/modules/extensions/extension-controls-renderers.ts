import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  registerWorkbenchExtensionControlsRenderers,
  type WorkbenchExtensionCommandContext,
} from "@pstdio/workbench/extensions";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { localizeExtensionValue } from "@/shared/extensions/extension-localization";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

export const registerExtensionControlsRenderers = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
): Disposable[] => {
  const { metadata, projectId } = input;
  const records = metadata.controlsRenderers ?? [];
  if (records.length === 0) return [];

  // Control params/labels are declared server-side, so the query callback emits `l10n()`
  // tokens for its fixed labels; resolve them here where i18n runs before they render.
  const queryHandlerIds = new Set(records.map((record) => record.queryHandlerId));
  const commandContext: WorkbenchExtensionCommandContext = {
    executeCommand: async (commandId, body) => {
      const response = await executeExtensionCommand(projectId, commandId, body);
      const isQueryHandler = queryHandlerIds.has(commandId);
      if (!isQueryHandler) publishExtensionCommandEvent(response);
      return isQueryHandler ? localizeExtensionValue(response, records[0]?.extensionId) : response;
    },
    projectId,
    workbench: ctx,
  };

  return [registerWorkbenchExtensionControlsRenderers(commandContext, records, metadata.panels ?? [])];
};
