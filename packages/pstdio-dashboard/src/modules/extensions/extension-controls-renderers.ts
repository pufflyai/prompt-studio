import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  registerWorkbenchExtensionControlsRenderers,
  type WorkbenchExtensionCommandContext,
} from "@pstdio/workbench/extensions";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { localizeExtensionValue } from "@/shared/extensions/extension-localization";
import {
  publishExtensionCommandEvent,
  subscribeToExtensionCommandFeed,
} from "@/shared/extensions/extension-webview-broadcast";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

export const registerExtensionControlsRenderers = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
): Disposable[] => {
  const { metadata, projectId } = input;
  const records = metadata.controlsRenderers ?? [];
  if (records.length === 0) return [];

  const disposables: Disposable[] = [];

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

  disposables.push(registerWorkbenchExtensionControlsRenderers(commandContext, records, metadata.panels ?? []));

  // Re-query a controls panel once its apply/reset callback persists so the panel
  // reflects the committed state. Live-save edits already update the local draft.
  const refreshTargets = new Map<string, string>();
  for (const record of records) {
    if (record.applyHandlerId) refreshTargets.set(record.applyHandlerId, record.id);
    if (record.resetHandlerId) refreshTargets.set(record.resetHandlerId, record.id);
  }

  if (refreshTargets.size > 0) {
    disposables.push({
      dispose: subscribeToExtensionCommandFeed((event) => {
        if (!event.outcome.ok) return;
        const rendererId = refreshTargets.get(event.commandId);
        if (rendererId && ctx.renderers.getControlsRenderer(rendererId)) {
          ctx.renderers.refreshControlsRenderer(rendererId);
        }
      }),
    });
  }

  return disposables;
};
