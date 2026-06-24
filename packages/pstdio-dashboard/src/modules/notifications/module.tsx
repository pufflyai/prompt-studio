import {
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";
import { subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardViewContribution } from "@/shared/workbench/contributions/dashboard-view-contributions";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { readNotificationItems } from "./notifications-data";
import { NotificationsInboxWidget } from "./notifications-inbox-widget";
import { notificationsModalStore } from "./notifications-store";

const NOTIFICATIONS_NODE_ID = "dashboard-notifications-sidebar-item";

const createNotificationsSection = () => ({
  id: "notifications-navigation",
  nodes: [
    {
      id: NOTIFICATIONS_NODE_ID,
      label: "Notifications",
      icon: "Bell",
      resource: dashboardResources.notifications,
      target: { kind: "command" as const, commandId: dashboardCommandIds.openInbox },
    },
  ],
});

const registerHeaderBell = (ctx: WorkbenchModuleContributionContext) => {
  let disposable: { dispose: () => void } | undefined;
  const register = () => {
    disposable?.dispose();
    const projectId = getDashboardSelectedProjectId(ctx);
    disposable = ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
      commandId: dashboardCommandIds.openNotifications,
      group: "primary",
      icon: "Bell",
      order: 5,
      badge: readNotificationItems(projectId).filter((item) => item.status === "open").length,
    });
  };
  register();
  const unsubscribeCollections = subscribeCollections((change) => {
    if (!change || change.table === "notifications") register();
  });
  const unsubscribeContext = ctx.context.store.subscribe(register);
  return {
    dispose: () => {
      disposable?.dispose();
      unsubscribeCollections();
      unsubscribeContext();
    },
  };
};

const registerSidebar = (ctx: WorkbenchModuleContributionContext) => {
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.notifications.project-sidebar",
    order: 30,
    placement: sidebarTreeContributionPlacements.afterWorkspaces,
    getSections: () => [createNotificationsSection()],
  });
  registerWorkspaceSidebarContribution(ctx, {
    id: "dashboard.notifications.workspace-sidebar",
    order: 30,
    placement: sidebarTreeContributionPlacements.afterWorkspaces,
    getSections: () => [createNotificationsSection()],
  });
};

export const createNotificationsModule = () =>
  ({
    id: "dashboard.notifications",
    activate(ctx) {
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openNotifications, label: "Open notifications", category: "Dashboard", icon: "Bell" },
        { execute: () => notificationsModalStore.toggle() },
      );
      ctx.commands.registerCommand(
        { id: dashboardCommandIds.openInbox, label: "Open inbox", category: "Dashboard", icon: "Bell" },
        { execute: () => ctx.resources.openResource(dashboardResources.notifications, { replaceActive: true }) },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openNotifications,
        order: 50,
      });
      registerDashboardViewContribution(ctx, {
        resource: dashboardResources.notifications,
        group: "Dashboard",
        order: 30,
      });
      ctx.layout.registerWidget({
        id: dashboardWidgetIds.notifications,
        title: dashboardResources.notifications.label,
        area: "main",
        singleton: true,
        rendererId: dashboardWidgetIds.notifications,
        priority: 30,
      });
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.notifications,
        render: (input) => <NotificationsInboxWidget input={input} />,
      });
      registerResourceRoute(ctx, {
        id: "dashboard.notifications.opener",
        match: (resource) => resource.kind === "dashboard-view" && resource.id === dashboardResources.notifications.id,
        mode: "project",
        widgetId: dashboardWidgetIds.notifications,
      });
      registerSidebar(ctx);
      return registerHeaderBell(ctx);
    },
  }) satisfies WorkbenchModuleContribution;
