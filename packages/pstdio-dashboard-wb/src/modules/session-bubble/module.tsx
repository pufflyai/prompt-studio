import type {
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { registerModeChromeContribution } from "../../shared/mode-chrome-contributions";
import { SessionBubbleHeader } from "../../shared/session/components/session-bubble-header";
import { SessionWidget } from "../../shared/session/components/session-widget";
import {
  forgetDashboardSession,
  getDashboardSelectedSession,
  rememberDashboardSessionResource,
} from "../../shared/session/session-selection";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { openSessionBubbleWidgets } from "./session-bubble";

const dashboardNewSessionDraftResource: ResourceRef = {
  kind: "session-draft",
  uri: "dashboard-workbench://session-draft/new",
  id: "new",
  label: "New session",
  icon: "PenBox",
};

const registerSessionBubbleWidgets = (ctx: WorkbenchModuleContributionContext) => {
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

  openSessionBubbleWidgets(ctx);
};

const openNewSessionDraft = (ctx: WorkbenchModuleContributionContext) => {
  forgetDashboardSession(ctx);

  if (ctx.modes.getActiveModeId() === "sessions" && ctx.layout.getWidget(dashboardWidgetIds.session)) {
    ctx.renderers.setSelectedNode(dashboardWidgetIds.sessionsSidebar, undefined);
    return ctx.layout.openWidget(dashboardWidgetIds.session, {
      resource: dashboardNewSessionDraftResource,
      title: dashboardNewSessionDraftResource.label,
      replaceActive: true,
    });
  }

  if (ctx.sessionPanel.getMode() === "closed") ctx.sessionPanel.setMode("bubble");
  const placement = openSessionBubbleWidgets(ctx, {
    resource: dashboardNewSessionDraftResource,
    title: dashboardNewSessionDraftResource.label,
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
    { execute: () => openNewSessionDraft(ctx) },
  );
};

export const createSessionBubbleModule = () =>
  ({
    id: "dashboard.session-bubble",
    activate(ctx) {
      registerSessionBubbleWidgets(ctx);
      registerSessionBubbleCommands(ctx);
      for (const modeId of ["project", "workspace", "settings"]) {
        registerModeChromeContribution(ctx, modeId, {
          id: "dashboard.session-bubble",
          activate: openRememberedSessionBubble,
        });
      }
    },
  }) satisfies WorkbenchModuleContribution;
