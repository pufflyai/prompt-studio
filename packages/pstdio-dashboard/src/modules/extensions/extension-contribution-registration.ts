import {
  registerWorkbenchExtensionCommandPaletteResources,
  registerWorkbenchExtensionFileRenderers,
  registerWorkbenchExtensionTreeRenderers,
} from "pstdio-extensions/workbench";
import {
  type Disposable,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import {
  buildDashboardExtensionCommandPaletteRegistrations,
  buildDashboardExtensionMenuRegistrations,
} from "@/shared/extensions/workbench-extension-contributions";
import {
  createExtensionCommandPaletteCommandHandler,
  createExtensionMenuCommandHandler,
  type ExecuteDashboardExtensionCommand,
} from "./extension-command-handler";
import { registerExtensionDataRenderers } from "./extension-data-renderers";
import { registerExtensionModeContributions } from "./extension-mode-layout";
import { registerExtensionResourceView } from "./extension-resource-view";
import { registerExtensionSettingsPanels } from "./extension-settings-panels";

export const disposeExtensionContributions = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

export const registerExtensionContributions = (input: {
  ctx: WorkbenchModuleContributionContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}) => {
  const { ctx, executeCommand, metadata, projectId } = input;
  const disposables: Disposable[] = [];

  for (const registration of buildDashboardExtensionMenuRegistrations(metadata)) {
    disposables.push(
      ctx.commands.registerCommand(
        registration.command,
        createExtensionMenuCommandHandler({
          ctx,
          contribution: registration.contribution,
          executeCommand,
          getActiveResource: () => ctx.getPrimaryResource(),
          projectId,
        }),
      ),
    );
    disposables.push(ctx.layout.registerMenuItem(registration.menuPath, registration.menuItem));
    for (const contextMenuItem of registration.contextMenuItems) {
      disposables.push(ctx.layout.registerMenuItem(contextMenuItem.menuPath, contextMenuItem.menuItem));
    }
  }

  for (const registration of buildDashboardExtensionCommandPaletteRegistrations(metadata)) {
    disposables.push(
      ctx.commands.registerCommand(
        registration.command,
        createExtensionCommandPaletteCommandHandler({
          ctx,
          contribution: registration.contribution,
          executeCommand,
          getActiveResource: () => ctx.getPrimaryResource(),
          projectId,
        }),
      ),
    );
    disposables.push(ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, registration.menuItem));
  }

  disposables.push(...registerExtensionDataRenderers(ctx, { metadata, projectId }));
  disposables.push(
    registerWorkbenchExtensionFileRenderers({
      // Publish so an edit that retitles the ticket refreshes the breadcrumb via the
      // command feed (the load response carries no id, so subscribers ignore it).
      executeCommand: async (commandId, body) => {
        const response = await executeCommand(projectId, commandId, body);
        publishExtensionCommandEvent(response);
        return response;
      },
      metadata,
      projectId,
      workbench: ctx as never,
    }),
  );
  disposables.push(
    registerWorkbenchExtensionTreeRenderers({
      executeCommand: async (commandId, body) => {
        const response = await executeCommand(projectId, commandId, body);
        const requestMetadata = (body as { metadata?: { treeId?: unknown } } | undefined)?.metadata;
        if (typeof requestMetadata?.treeId === "string") publishExtensionCommandEvent(response);
        return response;
      },
      metadata,
      projectId,
      workbench: ctx as never,
    }),
  );
  disposables.push(
    registerWorkbenchExtensionCommandPaletteResources(
      {
        executeCommand: (commandId, body) => executeCommand(projectId, commandId, body),
        projectId,
        workbench: ctx as never,
      },
      metadata.commandPaletteResources ?? [],
    ),
  );
  disposables.push(...registerExtensionModeContributions(ctx, metadata, projectId));
  disposables.push(...registerExtensionResourceView(ctx, { metadata, projectId }));
  disposables.push(...registerExtensionSettingsPanels(ctx, { metadata, projectId }));
  return disposables;
};
