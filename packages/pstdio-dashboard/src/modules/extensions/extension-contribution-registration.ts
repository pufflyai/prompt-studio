import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  fileRendererRefreshEnvelopeFromCommand,
  registerWorkbenchExtensionContributions,
  toWorkbenchWhenExpression,
} from "@pstdio/workbench/extensions";
import { createElement } from "react";
import { buildAbsoluteApiUrl } from "@/lib/api";
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
import { createDashboardSettingsWebviewFileCapabilities } from "@/shared/extensions/extension-webview-capabilities";
import { subscribeToResourceRemovals } from "@/shared/extensions/resource-removal-feed";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardWorkbenchWhenExpression,
  dashboardMenuTargetsById,
} from "@/shared/extensions/workbench-extension-contributions";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import {
  type ExecuteDashboardExtensionCommand,
  openSessionCommandResult,
  prepareExtensionCommandArgs,
} from "./extension-command-handler";
import { createDashboardKanbanAdapter, toDashboardExtensionResource } from "./extension-kanban-adapter";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";
import { withWorkspaceDiffMetadata } from "./extension-tree-workspace-diffs";

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

export const localizeDashboardExtensionCommandResponse = <T extends { extensionId: string }>(response: T) =>
  localizeExtensionValue(response, response.extensionId) as ResolvedLocalizable<T>;

export const registerExtensionContributions = (input: RegisterExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  try {
    disposables.push({
      dispose: subscribeToResourceRemovals((resource) => {
        if (resource.projectId === input.projectId) input.ctx.resources.removed(resource);
      }),
    });
    const menuResult = buildDashboardExtensionMenuRegistrations(input.metadata);
    for (const unresolved of menuResult.unresolved) {
      input.ctx.notifications.show({
        level: "warning",
        title: "Extension action unavailable",
        message: `The menu target “${unresolved.targetId}” for “${unresolved.contribution.label}” is not available.`,
      });
    }
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
        createWebviewHostCapabilityOverrides: ({ webviewId }) =>
          createDashboardSettingsWebviewFileCapabilities({
            metadata: input.metadata,
            projectId: input.projectId,
            webviewId,
          }),
        executeCommand: async (commandId, body, signal) => {
          const rawResponse = await input.executeCommand(input.projectId, commandId, body, signal);
          signal?.throwIfAborted();
          const treeId = body.slot?.context?.treeId;
          const decoratedResponse =
            typeof treeId === "string" ? await withWorkspaceDiffMetadata(rawResponse, undefined, signal) : rawResponse;
          const response = localizeDashboardExtensionCommandResponse(decoratedResponse);
          for (const notification of collectExtensionCommandNotifications(response)) {
            input.ctx.notifications.show({
              level: notification.level,
              title: notification.title,
              message: notification.message,
              metadata: notification.metadata,
            });
          }
          publishExtensionCommandEvent(response, {
            ...fileRendererRefreshEnvelopeFromCommand(body, response),
            projectId: input.projectId,
          });
          if (!response.outcome.ok || !response.outcome.navigationRequests?.length) {
            await openSessionCommandResult(input.ctx, input.projectId, response);
          }
          return response;
        },
        kanbanAdapter: kanban,
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
        resolveTreeNodeResource: (resource) => toDashboardExtensionResource(resource, input.projectId)!,
        renderWebview: (renderInput) => createElement(ExtensionViewWidget, { input: renderInput }),
        settingsSectionId: "project",
        settingsSectionTitle: "Project",
        subscribeRefreshEvents: (listener) => {
          const unsubscribe = subscribeToExtensionEventFeed((event) => {
            if (event.projectId === input.projectId) listener(event);
          });
          return { dispose: unsubscribe };
        },
        workbench: input.ctx,
      }),
      registerExtensionResourceHierarchy(input.ctx, { metadata: input.metadata, projectId: input.projectId }),
    );
  } catch (error) {
    disposeExtensionContributions(disposables);
    throw error;
  }
  return disposables;
};
