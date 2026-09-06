import { Badge } from "@chakra-ui/react";
import type { TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { getCollectionsVersion, subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerDashboardNavigationContribution } from "@/shared/workbench/dashboard-navigation-contribution";
import { NotificationCenterWidget } from "./components/notification-center-widget";
import { countPendingNotifications } from "./data/dashboard-notifications";

export const DASHBOARD_NOTIFICATIONS_KEYBINDING = "Alt+Shift+N";

const createNotificationNode = (ctx: WorkbenchModuleContext): TreeNode => {
  const count = countPendingNotifications(getDashboardSelectedProjectId(ctx));
  return {
    id: "dashboard.notifications.sidenav",
    label: "Notifications",
    icon: "Inbox",
    endContent:
      count > 0 ? (
        <Badge size="sm" variant="subtle" colorPalette="blue" flexShrink={0}>
          {count}
        </Badge>
      ) : undefined,
    target: { kind: "command", commandId: dashboardCommandIds.openNotifications },
  };
};

const registerNotificationSidenav = (ctx: WorkbenchModuleContext) => {
  registerDashboardNavigationContribution(ctx, {
    id: "dashboard.notifications.sidenav-nav",
    modes: ["project"],
    getSections: () => [{ id: "navigation.root", nodes: [createNotificationNode(ctx)] }],
  });
};

const refreshSidenavs = (ctx: WorkbenchModuleContext) => {
  if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav))
    ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
};

const registerNotificationWidget = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.notificationsModal,
    title: "Notifications",
    body: {
      kind: "react",
      render: (input) => <NotificationCenterWidget input={input} />,
    },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.notificationsModal,
    viewId: dashboardWidgetIds.notificationsModal,
    config: {
      size: "lg",
      placement: "center",
      scrollBehavior: "inside",
      closeTriggerTop: "3.5",
    },
  });
};

export const createNotificationsModule = () =>
  ({
    id: "dashboard.notifications",
    activate(ctx) {
      registerNotificationWidget(ctx);
      registerNotificationSidenav(ctx);
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openNotifications,
          label: "Open notifications",
          category: "Dashboard",
          icon: "Inbox",
        },
        {
          execute: () => ctx.overlays.openOverlay(dashboardWidgetIds.notificationsModal, { title: "Notifications" }),
        },
      );
      ctx.keybindings.registerKeybinding({
        action: { kind: "command", commandId: dashboardCommandIds.openNotifications },
        keybinding: DASHBOARD_NOTIFICATIONS_KEYBINDING,
        when: "!inputFocus",
      });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: dashboardCommandIds.openNotifications,
        order: 32,
      });

      const unsubscribeNotifications = subscribeCollections((change) => {
        if (change && change.table !== "notifications") return;
        refreshSidenavs(ctx);
      });
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => refreshSidenavs(ctx));
      getCollectionsVersion();

      return [{ dispose: unsubscribeNotifications }, { dispose: unsubscribeProject }];
    },
  }) satisfies WorkbenchModuleContribution;
