import type { Disposable, OpenWorkbenchViewInput, WorkbenchModuleContext } from "@pstdio/workbench";
import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  fileRendererRefreshEnvelopeFromCommand,
  registerWorkbenchExtensionContributions,
} from "@pstdio/workbench/extensions";
import { createElement } from "react";
import { buildAbsoluteApiUrl } from "@/lib/api";
import { prepareDashboardNavigationResource, selectDashboardNavigationView } from "@/shared/app/navigation-state";
import { uploadExtensionCommandFile } from "@/shared/extensions/api";
import { collectExtensionCommandNotifications } from "@/shared/extensions/command-outcome";
import { toWorkbenchContributionId } from "@/shared/extensions/contribution-ref";
import {
  localizeExtensionValue,
  type ResolvedLocalizable,
  type ResolvedWorkbenchExtensionMetadata,
} from "@/shared/extensions/extension-localization";
import {
  publishExtensionCommandEvent,
  subscribeToExtensionEventFeed,
} from "@/shared/extensions/extension-webview-broadcast";
import {
  buildDashboardExtensionMenuRegistrations,
  buildDashboardWorkbenchWhenExpression,
  dashboardMenuTargetsById,
} from "@/shared/extensions/workbench-extension-contributions";
import { setDashboardSidenavSelection } from "@/shared/workbench/dashboard-sidenav";
import { registerNavigationOwningMode } from "@/shared/workbench/mode-navigation-ownership";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { type ExecuteDashboardExtensionCommand, prepareExtensionCommandArgs } from "./extension-command-handler";
import { createDashboardKanbanAdapter, toDashboardExtensionResource } from "./extension-kanban-adapter";
import { registerExtensionNavigation, withoutDashboardNavigationItems } from "./extension-navigation";
import { registerExtensionResourceHierarchy } from "./extension-resource-hierarchy";
import { registerExtensionResourceSidenav, withoutIntegratedResourceSidenavViews } from "./extension-resource-sidenav";
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

export const extensionViewResolveInput =
  (ctx: WorkbenchModuleContext, view: { id: string; title: string; icon?: string }, navigationItemId = view.id) =>
  (openInput: OpenWorkbenchViewInput) => {
    if (openInput.resource) return openInput;
    selectDashboardNavigationView(ctx, view.id, { modeId: "project" });
    ctx.breadcrumbs.setItems([{ title: view.title, icon: view.icon }]);
    setDashboardSidenavSelection(ctx, navigationItemId);
    return openInput;
  };

export const registerExtensionActivityNavigationOwnership = (metadata: ResolvedWorkbenchExtensionMetadata) => {
  const modeIds = new Set((metadata.activityItems ?? []).flatMap((item) => item.modes.map(toWorkbenchContributionId)));
  const registrations = [...modeIds].map(registerNavigationOwningMode);
  return {
    dispose() {
      for (const registration of registrations) registration.dispose();
    },
  };
};

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

export const registerDashboardExtensionWebviewRenderer = (ctx: WorkbenchModuleContext) => {
  if (ctx.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)) return undefined;
  return ctx.renderers.registerRenderer({
    id: BRIDGE_WEBVIEW_RENDERER_ID,
    render: (renderInput) => createElement(ExtensionViewWidget, { input: renderInput }),
  });
};

export const localizeDashboardExtensionCommandResponse = <T extends { extensionId: string }>(response: T) =>
  localizeExtensionValue(response, response.extensionId) as ResolvedLocalizable<T>;

export const registerExtensionContributions = (input: RegisterExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  try {
    const menuResult = buildDashboardExtensionMenuRegistrations(input.metadata);
    for (const unresolved of menuResult.unresolved) {
      input.ctx.notifications.show({
        level: "warning",
        title: "Extension action unavailable",
        message: `The menu target “${unresolved.targetId}” for “${unresolved.contribution.label}” is not available.`,
      });
    }
    const webviewRenderer = registerDashboardExtensionWebviewRenderer(input.ctx);
    if (webviewRenderer) disposables.push(webviewRenderer);
    const kanban = createDashboardKanbanAdapter(input);
    disposables.push(kanban.disposable);
    disposables.push(
      registerWorkbenchExtensionContributions({
        createKeybindingWhenExpression: buildDashboardWorkbenchWhenExpression,
        createMenuWhenExpression: (contribution) => buildDashboardWorkbenchWhenExpression(contribution.when),
        executeCommand: async (commandId, body) => {
          const rawResponse = await input.executeCommand(input.projectId, commandId, body);
          const treeId = body.slot?.context?.treeId;
          const decoratedResponse =
            typeof treeId === "string" ? await withWorkspaceDiffMetadata(rawResponse) : rawResponse;
          const response = localizeDashboardExtensionCommandResponse(decoratedResponse);
          for (const notification of collectExtensionCommandNotifications(response)) {
            input.ctx.notifications.show({
              level: notification.level,
              title: notification.title,
              message: notification.message,
              metadata: notification.metadata,
            });
          }
          publishExtensionCommandEvent(response, fileRendererRefreshEnvelopeFromCommand(body, response));
          return response;
        },
        kanbanAdapter: kanban.adapter,
        menuSlotsById: menuResult.menuSlotsById,
        menuTargetsById: dashboardMenuTargetsById,
        menuRegistrations: menuResult.registrations,
        metadata: withoutIntegratedResourceSidenavViews(
          withoutDashboardNavigationItems(withDashboardWebviewUrls(input.metadata)),
        ),
        prepareCommandArgs: (commandId, args, _context, onArgsChange) =>
          prepareExtensionCommandArgs({
            args,
            commandId,
            onArgsChange,
            projectId: input.projectId,
            uploadFile: uploadExtensionCommandFile,
          }),
        prepareResource: (resource) => prepareDashboardNavigationResource(input.ctx, resource),
        projectId: input.projectId,
        resolveTreeNodeResource: (resource) => toDashboardExtensionResource(resource, input.projectId)!,
        resolveViewInput: (view) => {
          const navigationItem = input.metadata.navigationItems.find(
            (item) => item.action.kind === "view" && toWorkbenchContributionId(item.action.view) === view.id,
          );
          return extensionViewResolveInput(input.ctx, view, navigationItem?.id);
        },
        settingsSectionId: "project",
        settingsSectionTitle: "Project",
        subscribeRefreshEvents: (listener) => {
          const unsubscribe = subscribeToExtensionEventFeed(listener);
          return { dispose: unsubscribe };
        },
        workbench: input.ctx,
      }),
      registerExtensionActivityNavigationOwnership(input.metadata),
      registerExtensionNavigation(input.ctx, input.metadata),
      registerExtensionResourceSidenav(input.ctx, input.metadata),
      registerExtensionResourceHierarchy(input.ctx, { metadata: input.metadata, projectId: input.projectId }),
    );
  } catch (error) {
    disposeExtensionContributions(disposables);
    throw error;
  }
  return disposables;
};
