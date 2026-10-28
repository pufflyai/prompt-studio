import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  fileRendererRefreshEnvelopeFromCommand,
  registerWorkbenchExtensionContributions,
  toWorkbenchWhenExpression,
} from "@pstdio/workbench/extensions";
import { createElement } from "react";
import { buildAbsoluteApiUrl, getApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { uploadExtensionCommandFile } from "@/shared/extensions/api";
import { collectExtensionCommandNotifications } from "@/shared/extensions/command-outcome";
import {
  localizeExtensionValue,
  type ResolvedLocalizable,
  type ResolvedWorkbenchExtensionMetadata,
} from "@/shared/extensions/extension-localization";
import {
  publishExtensionCommandEvent,
  subscribeToExtensionEventFeed,
  subscribeToExtensionEventReset,
} from "@/shared/extensions/extension-webview-broadcast";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardWorkbenchWhenExpression,
  dashboardMenuTargetsById,
} from "@/shared/extensions/workbench-extension-contributions";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { createSharedTableViews } from "./extension-board-views";
import {
  type ExecuteDashboardExtensionCommand,
  openSessionCommandResult,
  prepareExtensionCommandArgs,
} from "./extension-command-handler";
import { createDashboardKanbanAdapter, toDashboardExtensionResource } from "./extension-kanban-adapter";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";
import { watchOpenExtensionResource } from "./extension-resource-sync";
import { registerExtensionSetupShortcuts } from "./extension-setup-shortcuts";
import { withWorkspaceDiffMetadata } from "./extension-tree-workspace-diffs";

// Shown once for the registered set, never for the trial sets that isolate a failing extension.
export const notifyUnresolvedExtensionMenus = (
  ctx: Pick<WorkbenchModuleContext, "notifications">,
  metadata: ResolvedWorkbenchExtensionMetadata,
) => {
  for (const unresolved of buildDashboardExtensionMenuRegistrations(metadata).unresolved) {
    ctx.notifications.show({
      level: "warning",
      title: "Extension action unavailable",
      message: `The menu target “${unresolved.targetId}” for “${unresolved.contribution.label}” is not available.`,
    });
  }
};

export const disposeExtensionContributions = (disposables: Disposable[]) => {
  for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
};

interface RegisterExtensionContributionsInput {
  ctx: WorkbenchModuleContext;
  executeCommand: ExecuteDashboardExtensionCommand;
  metadata: ResolvedWorkbenchExtensionMetadata;
  projectId: string;
}

export const withDashboardWebviewUrls = (
  metadata: ResolvedWorkbenchExtensionMetadata,
): ResolvedWorkbenchExtensionMetadata => ({
  ...metadata,
  views: metadata.views.map((view) => {
    if (view.body.kind !== "webview") return view;
    return {
      ...view,
      body: {
        ...view.body,
        webview: {
          ...view.body.webview,
          runtimeUrl: buildAbsoluteApiUrl(view.body.webview.runtimeUrl),
          moduleUrl: buildAbsoluteApiUrl(view.body.webview.moduleUrl),
          styles: view.body.webview.styles?.map((url) => buildAbsoluteApiUrl(url)),
        },
      },
    };
  }),
});

export const localizeDashboardExtensionCommandResponse = <T extends { extensionId: string }>(
  response: T,
  owner = getRuntimeCollections(),
) => localizeExtensionValue(response, response.extensionId, owner) as ResolvedLocalizable<T>;

export const registerExtensionContributions = (input: RegisterExtensionContributionsInput) => {
  const owner = getRuntimeCollections();
  const disposables: Disposable[] = [];
  try {
    disposables.push({
      dispose: subscribeToResourceRemovals((resource) => {
        if (resource.projectId === input.projectId) input.ctx.resources.removed(resource);
      }),
    });
    const menuResult = buildDashboardExtensionMenuRegistrations(input.metadata);
    const kanban = createDashboardKanbanAdapter(input);
    disposables.push({
      dispose: subscribeToExtensionEventReset(() => {
        for (const view of input.metadata.views) input.ctx.views.refreshView(view.id);
      }),
    });
    disposables.push(
      registerWorkbenchExtensionContributions({
        createKeybindingWhenExpression: buildDashboardWorkbenchWhenExpression,
        createMenuWhenExpression: (contribution) => buildDashboardWorkbenchWhenExpression(contribution.when),
        createNavigationWhenExpression: (when) =>
          buildDashboardWorkbenchWhenExpression(toWorkbenchWhenExpression(when)),
        executeCommand: async (commandId, body, signal) => {
          const reportActionError = input.ctx.notifications.captureActionError("Extension command");
          const rawResponse = await input.executeCommand(input.projectId, commandId, body, signal);
          signal?.throwIfAborted();
          const treeId = body.slot?.context?.treeId;
          const decoratedResponse =
            typeof treeId === "string" ? await withWorkspaceDiffMetadata(rawResponse, undefined, signal) : rawResponse;
          const response = localizeDashboardExtensionCommandResponse(decoratedResponse, owner);
          for (const notification of collectExtensionCommandNotifications(response)) {
            if (notification.level === "error") {
              reportActionError(new Error(notification.message ?? notification.title));
              continue;
            }
            input.ctx.notifications.show({
              level: notification.level,
              title: notification.title,
              message: notification.message,
              metadata: notification.metadata,
            });
          }
          publishExtensionCommandEvent(
            response,
            {
              ...fileRendererRefreshEnvelopeFromCommand(body, response),
              projectId: input.projectId,
            },
            owner,
          );
          if (!response.outcome.ok || !response.outcome.navigationRequests?.length) {
            await openSessionCommandResult(input.ctx, input.projectId, response);
          }
          return response;
        },
        kanbanAdapter: kanban,
        nativeDocuments: getApiClient().nativeDocuments,
        dataTableAdapter: {
          resolveRowResource: (_record, row) =>
            toDashboardExtensionResource(row.resource, input.projectId, input.metadata.resourceKinds),
          createViewsProvider: (record) => createSharedTableViews(input.projectId, record, input.metadata),
        },
        menuSlotsById: menuResult.menuSlotsById,
        menuTargetsById: dashboardMenuTargetsById,
        menuRegistrations: menuResult.registrations,
        metadata: withDashboardWebviewUrls(input.metadata),
        prepareCommandArgs: (commandId, args, _context, onArgsChange) =>
          prepareExtensionCommandArgs({
            args,
            commandId,
            onArgsChange,
            projectId: input.projectId,
            uploadFile: uploadExtensionCommandFile,
          }),
        projectId: input.projectId,
        resolveTreeNodeResource: (resource) =>
          toDashboardExtensionResource(resource, input.projectId, input.metadata.resourceKinds)!,
        renderWebview: (renderInput) => createElement(ExtensionViewWidget, { input: renderInput }),
        settingsSectionId: "project",
        settingsSectionTitle: "Project",
        subscribeRefreshEvents: (listener) => {
          const unsubscribe = subscribeToExtensionEventFeed((event) => {
            if (event.projectId === input.projectId) listener(event);
          });
          return { dispose: unsubscribe };
        },
        subscribeRefreshReset: (listener) => ({ dispose: subscribeToExtensionEventReset(listener, owner) }),
        workbench: input.ctx,
      }),
      registerExtensionResourceHierarchy(input.ctx, { metadata: input.metadata, projectId: input.projectId }),
      ...registerExtensionSetupShortcuts(input.ctx, input.metadata),
      watchOpenExtensionResource(input.ctx, input),
    );
  } catch (error) {
    disposeExtensionContributions(disposables);
    throw error;
  }
  return disposables;
};
