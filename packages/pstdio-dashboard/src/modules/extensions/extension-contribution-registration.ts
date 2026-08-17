import { type Disposable, type WorkbenchModuleContext, workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import {
  registerWorkbenchExtensionCommandPaletteResources,
  registerWorkbenchExtensionDataTableRenderers,
  registerWorkbenchExtensionFileRenderers,
  registerWorkbenchExtensionRendererRefreshEvents,
  registerWorkbenchExtensionTreeRenderers,
} from "@pstdio/workbench/extensions";
import { collectExtensionCommandNotifications } from "@/shared/extensions/command-outcome";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import {
  publishExtensionCommandEvent,
  subscribeToExtensionEventFeed,
} from "@/shared/extensions/extension-webview-broadcast";
import {
  buildDashboardExtensionCommandPaletteRegistrations,
  buildDashboardExtensionMenuRegistrations,
} from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionFooterNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import {
  createExtensionCommandPaletteCommandHandler,
  createExtensionMenuCommandHandler,
  type ExecuteDashboardExtensionCommand,
} from "./extension-command-handler";
import { registerExtensionControlsRenderers } from "./extension-controls-renderers";
import { registerExtensionKanbanRenderers } from "./extension-kanban-renderers";
import { registerExtensionModeContributions } from "./extension-mode-layout";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";
import { registerExtensionResourceView } from "./extension-resource-view";
import { registerExtensionSettingsPanels } from "./extension-settings-panels";
import {
  isExtensionResourceSidenavView,
  registerExtensionResourceSidenavContributions,
} from "./extension-sidenav-contributions";
import { withWorkspaceDiffMetadata } from "./extension-tree-workspace-diffs";

export const disposeExtensionContributions = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

interface RegisterExtensionContributionsInput {
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
  onRegistrationError?: (error: unknown, extensionId: string) => void;
}

const extensionIdOf = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const extensionId = (value as { extensionId?: unknown }).extensionId;
  return typeof extensionId === "string" ? extensionId : undefined;
};

const extensionMetadataById = (metadata: ResolvedWorkbenchExtensionMetadata, extensionId: string) => {
  const scoped = <T>(records: T[] | undefined) => records?.filter((record) => extensionIdOf(record) === extensionId);

  return {
    ...metadata,
    extensions: metadata.extensions.filter((extension) => extension.id === extensionId),
    commands: scoped(metadata.commands) ?? [],
    commandPaletteContributions: scoped(metadata.commandPaletteContributions),
    diagnostics: metadata.diagnostics.filter((diagnostic) => diagnostic.extensionId === extensionId),
    menuContributions: scoped(metadata.menuContributions) ?? [],
    modes: scoped(metadata.modes) ?? [],
    routes: scoped(metadata.routes) ?? [],
    kanbanRenderers: scoped(metadata.kanbanRenderers),
    dataTableRenderers: scoped(metadata.dataTableRenderers),
    commandPaletteResources: scoped(metadata.commandPaletteResources),
    treeRenderers: scoped(metadata.treeRenderers),
    fileRenderers: scoped(metadata.fileRenderers),
    controlsRenderers: scoped(metadata.controlsRenderers),
    keybindings: scoped(metadata.keybindings),
    settingsSections: scoped(metadata.settingsSections),
    settingsPanels: scoped(metadata.settingsPanels) ?? [],
    settingsDefinitions: scoped(metadata.settingsDefinitions),
    treeItems: scoped(metadata.treeItems),
    activityItems: scoped(metadata.activityItems),
    panels: scoped(metadata.panels) ?? [],
  } satisfies ResolvedWorkbenchExtensionMetadata;
};

const metadataExtensionIds = (metadata: ResolvedWorkbenchExtensionMetadata) => {
  const ids = new Set(metadata.extensions.map((extension) => extension.id));
  for (const records of Object.values(metadata)) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      const extensionId = extensionIdOf(record);
      if (extensionId) ids.add(extensionId);
    }
  }
  return [...ids];
};

const registerSingleExtensionContributions = (
  input: Omit<RegisterExtensionContributionsInput, "onRegistrationError">,
) => {
  const { ctx, executeCommand, metadata, projectId } = input;
  const disposables: Disposable[] = [];
  try {
    const treeRendererMetadata = {
      ...metadata,
      panels: metadata.panels.filter((view) => !isExtensionResourceSidenavView(metadata, view)),
    };

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
      for (const item of registration.menuItems) {
        disposables.push(ctx.layout.registerMenuItem(item.menuPath, item.menuItem));
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

    disposables.push(...registerExtensionKanbanRenderers(ctx, { executeCommand, metadata, projectId }));
    disposables.push(
      registerWorkbenchExtensionDataTableRenderers(
        {
          executeCommand: async (commandId, body) => {
            const response = await executeCommand(projectId, commandId, body);
            for (const notification of collectExtensionCommandNotifications(response)) {
              ctx.notifications.show({
                level: notification.level,
                title: notification.title,
                message: notification.message,
                metadata: notification.metadata,
              });
            }
            publishExtensionCommandEvent(response);
            return response;
          },
          projectId,
          workbench: ctx,
        },
        metadata.dataTableRenderers ?? [],
        metadata.panels,
      ),
    );
    disposables.push(...registerExtensionControlsRenderers(ctx, { metadata, projectId }));
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
        workbench: ctx,
      }),
    );
    disposables.push(
      registerWorkbenchExtensionTreeRenderers({
        executeCommand: async (commandId, body) => {
          const response = await executeCommand(projectId, commandId, body);
          const decoratedResponse = await withWorkspaceDiffMetadata(response);
          const requestMetadata = (body as { metadata?: { treeId?: unknown } } | undefined)?.metadata;
          if (typeof requestMetadata?.treeId === "string") publishExtensionCommandEvent(decoratedResponse);
          return decoratedResponse;
        },
        getHostTreeFooterNodes: () => {
          const mode = ctx.modes.getActiveModeId();
          return mode ? getSidenavContributionFooterNodes(ctx, mode) : [];
        },
        metadata: treeRendererMetadata,
        projectId,
        // Tree node resources must share the dashboard's canonical URIs; the
        // workbench default scheme would give the same resource a second
        // identity (own layout scope, history entry, and hierarchy key).
        resolveNodeResource: (resource) => ({
          kind: resource.type,
          uri: `dashboard-workbench://${resource.type}/${resource.id}`,
          id: resource.id,
          label: resource.label,
          metadata: { ...resource.metadata, projectId },
        }),
        workbench: ctx,
      }),
    );
    disposables.push(registerExtensionResourceSidenavContributions(ctx, metadata));
    disposables.push(
      registerWorkbenchExtensionCommandPaletteResources(
        {
          executeCommand: (commandId, body) => executeCommand(projectId, commandId, body),
          projectId,
          workbench: ctx,
        },
        metadata.commandPaletteResources ?? [],
      ),
    );
    disposables.push(...registerExtensionModeContributions(ctx, metadata, projectId));
    disposables.push(registerExtensionResourceHierarchy(ctx, { metadata, projectId }));
    disposables.push(...registerExtensionResourceView(ctx, { metadata, projectId }));
    disposables.push(...registerExtensionSettingsPanels(ctx, { metadata, projectId }));
    disposables.push(
      registerWorkbenchExtensionRendererRefreshEvents({
        metadata,
        subscribe: (listener) => ({ dispose: subscribeToExtensionEventFeed(listener) }),
        workbench: ctx,
      }),
    );
    return disposables;
  } catch (error) {
    disposeExtensionContributions(disposables);
    throw error;
  }
};

export const registerExtensionContributions = (input: RegisterExtensionContributionsInput) => {
  const disposables: Disposable[] = [];

  for (const extensionId of metadataExtensionIds(input.metadata)) {
    try {
      disposables.push(
        ...registerSingleExtensionContributions({
          ctx: input.ctx,
          executeCommand: input.executeCommand,
          metadata: extensionMetadataById(input.metadata, extensionId),
          projectId: input.projectId,
        }),
      );
    } catch (error) {
      input.onRegistrationError?.(error, extensionId);
    }
  }

  return disposables;
};
