import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "@pstdio/workbench/core";
import { SessionWidget } from "@/modules/sessions/components/session-widget";
import {
  forgetDashboardSession,
  getDashboardSelectedSession,
  rememberDashboardSessionResource,
} from "@/modules/sessions/state/session-selection";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerModeChromeContribution } from "@/shared/workbench/contributions/mode-chrome-contributions";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";
import { openSessionBubbleWidgets } from "./session-bubble";
import { SessionBubbleHeader } from "./session-bubble-header";

const metadataString = (resource: ResourceRef | undefined, key: string) => {
  const value = resource?.metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

const createDefaultWorkspaceResource = (ctx: WorkbenchModuleContributionContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) return undefined;

  const workspace = createDashboardWorkspaceOptions(projectId)[0];
  if (!workspace) return undefined;

  return createDashboardResource("workspace", workspace.id, workspace.title, "GitBranch", projectId, {
    workspaceId: workspace.id,
    workspaceShorthand: workspace.shorthand,
    ...(workspace.branch ? { workspaceBranch: workspace.branch } : {}),
  });
};

const getWorkspaceModeResource = (ctx: WorkbenchModuleContributionContext) => {
  if (ctx.modes.getActiveModeId() !== "workspace") return undefined;

  const resource = ctx.getPrimaryResource();
  return resource?.kind === "workspace" ? resource : undefined;
};

const createNewSessionDraftResource = (workspace: ResourceRef | undefined): ResourceRef => {
  const workspaceId = workspace?.id ?? metadataString(workspace, "workspaceId");
  const workspaceShorthand = metadataString(workspace, "workspaceShorthand");
  const workspaceBranch = metadataString(workspace, "workspaceBranch");
  const workspaceTitle = workspace?.label ?? workspaceShorthand;
  const id = workspaceId ? `new-${workspaceId}` : "new";

  return {
    kind: "session-draft",
    uri: `dashboard-workbench://session-draft/${id}`,
    id,
    label: "New session",
    icon: "PenBox",
    metadata: {
      ...(workspaceId ? { workspaceId } : {}),
      ...(workspaceTitle ? { workspaceTitle } : {}),
      ...(workspaceShorthand ? { workspaceShorthand } : {}),
      ...(workspaceBranch ? { workspaceBranch } : {}),
    },
  };
};

const selectSidebarSessionNode = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef | undefined) => {
  const nodeId = resource?.kind === "session" ? resource.uri : undefined;

  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, nodeId);
  }
};

const registerSessionBubbleWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubbleHeader,
      title: "Session bubble header",
      area: "floating-header",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubbleHeader,
      priority: 30,
    },
    { priority: 30 },
  );

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubbleHeader,
    render: (input) => <SessionBubbleHeader input={input} />,
  });

  ctx.layout.registerWidget(
    {
      id: dashboardWidgetIds.sessionBubble,
      title: "Session bubble",
      area: "floating",
      singleton: true,
      rendererId: dashboardWidgetIds.sessionBubble,
      priority: 30,
    },
    { priority: 30 },
  );

  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.sessionBubble,
    render: (input) => <SessionWidget input={input} />,
  });

  openSessionBubbleWidgets(ctx);
};

const openNewSessionDraft = (ctx: WorkbenchModuleContributionContext, input: { workspace?: ResourceRef } = {}) => {
  const workspace = input.workspace ?? getWorkspaceModeResource(ctx) ?? createDefaultWorkspaceResource(ctx);
  const draftResource = createNewSessionDraftResource(workspace);
  forgetDashboardSession(ctx);
  selectSidebarSessionNode(ctx, undefined);

  if (ctx.modes.getActiveModeId() === "sessions" && ctx.layout.getWidget(dashboardWidgetIds.session)) {
    return ctx.resources.openResource(draftResource, { replaceActive: true });
  }

  if (ctx.sessionPanel.getMode() === "closed") ctx.sessionPanel.setMode("bubble");
  const placement = openSessionBubbleWidgets(ctx, {
    resource: draftResource,
    title: draftResource.label,
  });
  return placement.bubble;
};

const openRememberedSessionBubble = (ctx: WorkbenchModuleContributionContext) => {
  const session = getDashboardSelectedSession(ctx);
  openSessionBubbleWidgets(ctx, session ? { resource: session.resource, title: session.title } : {});
  return undefined;
};

const registerSessionBubbleCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.openFloatingSession,
      label: "Open floating session",
      category: "Dashboard",
      icon: "MessageCircle",
    },
    {
      execute: async (args) => {
        const { resource, selectWorkspaceSidebar = true } = (args ?? {}) as {
          resource?: ResourceRef;
          selectWorkspaceSidebar?: boolean;
        };
        if (resource?.kind !== "session" || !resource.id) return undefined;

        rememberDashboardSessionResource(ctx, resource);
        const placement = openSessionBubbleWidgets(ctx, { resource, title: resource.label });
        selectSidebarSessionNode(ctx, resource);
        if (
          selectWorkspaceSidebar &&
          ctx.modes.getActiveModeId() === "workspace" &&
          ctx.commands.getCommand(dashboardCommandIds.selectWorkspaceSidebarSession)
        ) {
          await ctx.commands.executeCommand(dashboardCommandIds.selectWorkspaceSidebarSession, {
            resource,
          });
        }
        if (ctx.sessionPanel.getMode() === "closed") ctx.sessionPanel.setMode("bubble");
        return placement.bubble;
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.createSession, label: "New session", category: "Dashboard", icon: "PenBox" },
    {
      execute: (args) => {
        const { workspace } = (args ?? {}) as { workspace?: ResourceRef };
        return openNewSessionDraft(ctx, { workspace });
      },
    },
  );
};

export const createSessionBubbleModule = () =>
  ({
    id: "dashboard.session-bubble",
    activate(ctx) {
      registerSessionBubbleWidgets(ctx);
      registerSessionBubbleCommands(ctx);
      registerModeChromeContribution(ctx, "*", {
        id: "dashboard.session-bubble",
        activate: openRememberedSessionBubble,
      });
    },
  }) satisfies WorkbenchModuleContribution;
