import type { TreeNode, WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { getCollectionsVersion, subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  registerProjectSidebarContribution,
  registerWorkspaceSidebarContribution,
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { NotificationCenterWidget } from "./components/notification-center-widget";
import { countPendingNotifications } from "./data/dashboard-notifications";

const notificationLabel = (count: number) => (count > 0 ? `Notifications (${count})` : "Notifications");

const createNotificationNode = (ctx: WorkbenchModuleContributionContext): TreeNode => {
  const count = countPendingNotifications(getDashboardSelectedProjectId(ctx));
  return {
    id: "dashboard.notifications.sidebar",
    label: notificationLabel(count),
    icon: "Inbox",
    target: { kind: "command", commandId: dashboardCommandIds.openNotifications },
  };
};

const registerNotificationSidebar = (ctx: WorkbenchModuleContributionContext) => {
  const contribution = {
    id: "dashboard.notifications.sidebar-nav",
    order: 15,
    placement: sidebarTreeContributionPlacements.beforeWorkspaces,
    getSections: () => [{ id: "notification-navigation", nodes: [createNotificationNode(ctx)] }],
  };
  registerProjectSidebarContribution(ctx, contribution);
  registerWorkspaceSidebarContribution(ctx, contribution);
};

const refreshSidebars = (ctx: WorkbenchModuleContributionContext) => {
  ctx.renderers.refresh(dashboardWidgetIds.projectSidebar);
  ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
};

const registerNotificationWidget = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.notificationsModal,
    title: "Notifications",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.notificationsModal,
    config: {
      size: "xl",
      placement: "top",
      scrollBehavior: "inside",
      contentHeight: "min(34rem, calc(100dvh - 4rem))",
      contentMaxHeight: "calc(100dvh - 4rem)",
    },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.notificationsModal,
    render: (input) => <NotificationCenterWidget input={input} />,
  });
};

export const createNotificationsModule = () =>
  ({
    id: "dashboard.notifications",
    activate(ctx) {
      registerNotificationWidget(ctx);
      registerNotificationSidebar(ctx);
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openNotifications,
          label: "Open notifications",
          category: "Dashboard",
          icon: "Inbox",
        },
        {
          execute: () =>
            ctx.layout.openWidget(dashboardWidgetIds.notificationsModal, {
              title: "Notifications",
              closable: true,
            }),
        },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openNotifications,
        order: 32,
      });

      const unsubscribeNotifications = subscribeCollections((change) => {
        if (change && change.table !== "notifications") return;
        refreshSidebars(ctx);
      });
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => refreshSidebars(ctx));
      getCollectionsVersion();

      return [{ dispose: unsubscribeNotifications }, { dispose: unsubscribeProject }];
    },
  }) satisfies WorkbenchModuleContribution;
