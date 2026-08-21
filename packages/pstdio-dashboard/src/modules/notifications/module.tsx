import { Badge } from "@chakra-ui/react";
import type { TreeNode, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench";
import { getCollectionsVersion, subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
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
  registerSidenavContribution(ctx, {
    id: "dashboard.notifications.sidenav-nav",
    modes: ["*"],
    region: "header",
    order: 10,
    getHeaderNodes: () => [createNotificationNode(ctx)],
  });
};

const refreshSidenavs = (ctx: WorkbenchModuleContext) => {
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
    ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
  }
};

const registerNotificationWidget = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    id: dashboardWidgetIds.notificationsModal,
    title: "Notifications",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.notificationsModal,
    config: {
      size: "lg",
      placement: "center",
      scrollBehavior: "inside",
      closeTriggerTop: "3.5",
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
      registerNotificationSidenav(ctx);
      ctx.commands.registerCommand(
        {
          id: dashboardCommandIds.openNotifications,
          label: "Open notifications",
          category: "Dashboard",
          icon: "Inbox",
        },
        {
          execute: () =>
            ctx.layout.openPanel(dashboardWidgetIds.notificationsModal, {
              title: "Notifications",
              closable: true,
            }),
        },
      );
      ctx.keybindings.registerKeybinding({
        commandId: dashboardCommandIds.openNotifications,
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
