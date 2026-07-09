import { Badge } from "@chakra-ui/react";
import type { TreeNode, WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench/core";
import { getCollectionsVersion, subscribeCollections } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { NotificationCenterWidget } from "./components/notification-center-widget";
import { countPendingNotifications } from "./data/dashboard-notifications";

export const DASHBOARD_NOTIFICATIONS_KEYBINDING = "Alt+Shift+N";

const createNotificationNode = (ctx: WorkbenchModuleContributionContext): TreeNode => {
  const count = countPendingNotifications(getDashboardSelectedProjectId(ctx));
  return {
    id: "dashboard.notifications.sidebar",
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

const registerNotificationSidebar = (ctx: WorkbenchModuleContributionContext) => {
  registerSidebarContribution(ctx, {
    id: "dashboard.notifications.sidebar-nav",
    modes: ["project", "workspace"],
    region: "header",
    order: 1,
    getHeaderNodes: () => [createNotificationNode(ctx)],
  });
};

const refreshSidebars = (ctx: WorkbenchModuleContributionContext) => {
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
    ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
  }
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
        refreshSidebars(ctx);
      });
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => refreshSidebars(ctx));
      getCollectionsVersion();

      return [{ dispose: unsubscribeNotifications }, { dispose: unsubscribeProject }];
    },
  }) satisfies WorkbenchModuleContribution;
