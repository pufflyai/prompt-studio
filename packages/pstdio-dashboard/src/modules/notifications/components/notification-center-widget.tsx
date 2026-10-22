import { Stack, Text } from "@chakra-ui/react";
import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { NotificationCenter, type NotificationCenterAction, type NotificationCenterItem } from "@pstdio/ui";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import type { Notification, NotificationAction } from "pstdio-api-contracts";
import { useSyncExternalStore } from "react";
import { getApiClient } from "@/lib/api";
import { getCollectionsVersion, getRuntimeCollections, subscribeCollections } from "@/lib/sync/collections";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { useActionError } from "@/shared/components/use-action-error";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { collectExtensionCommandNotifications } from "@/shared/extensions/command-outcome";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import { createDashboardNotifications, toWorkbenchResource } from "../data/dashboard-notifications";

interface NotificationCenterWidgetProps {
  input: WorkbenchPanelRenderInput;
}

const formatRelativeTime = (iso: string) => {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const sourceLabel = (notification: Notification) => {
  if (notification.origin === "extension" && notification.sourceExtensionId) return notification.sourceExtensionId;
  return notification.source;
};

const toCenterAction = (action: NotificationAction): NotificationCenterAction => ({
  id: action.id,
  label: action.label,
  primary: action.primary,
  destructive: action.kind === "command" ? action.destructive : undefined,
});

const toCenterItem = (notification: Notification): NotificationCenterItem => ({
  id: notification.id,
  title: notification.title,
  body: notification.body,
  kind: notification.kind,
  priority: notification.priority,
  status: notification.status,
  sourceLabel: sourceLabel(notification),
  targetLabel: notification.target?.label ?? notification.target?.id,
  timeLabel: formatRelativeTime(notification.updatedAt || notification.createdAt),
  actions: notification.actions.map(toCenterAction),
  searchText: [notification.dedupeKey, notification.target?.type, notification.target?.id].filter(Boolean).join(" "),
});

const notificationByItem = (notifications: Notification[], item: NotificationCenterItem) =>
  notifications.find((notification) => notification.id === item.id);

const actionByItem = (notification: Notification, itemAction: NotificationCenterAction) =>
  notification.actions.find((action) => action.id === itemAction.id);

const primaryAction = (notification: Notification) =>
  notification.actions.find((action) => action.primary) ?? notification.actions[0];

const markRead = async (notification: Notification) => {
  if (notification.status !== "open") return;
  await getApiClient().notifications.markRead(notification.projectId, notification.id);
};

export const surfaceNotificationCommandResponse = (
  input: Pick<WorkbenchPanelRenderInput, "workbench">,
  response: CommandExecutionResult,
  projectId: string,
  owner = getRuntimeCollections(),
) => {
  for (const commandNotification of collectExtensionCommandNotifications(response)) {
    if (commandNotification.level === "error") {
      throw new Error(commandNotification.message ?? commandNotification.title);
    }
    input.workbench.notifications.show({
      level: commandNotification.level,
      title: commandNotification.title,
      message: commandNotification.message,
      metadata: commandNotification.metadata,
    });
  }
  publishExtensionCommandEvent(response, { projectId }, owner);
  if (!response.outcome.ok)
    throw new Error(response.outcome.error?.message ?? response.outcome.reason ?? "Notification action failed.");
};

export const NotificationCenterWidget = (props: NotificationCenterWidgetProps) => {
  const owner = getRuntimeCollections();
  const { input } = props;
  const { showError, errorNotice, clearError } = useActionError();
  useSyncExternalStore(subscribeCollections, getCollectionsVersion, getCollectionsVersion);
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const notifications = createDashboardNotifications(projectId);
  const items = notifications.map(toCenterItem);

  const close = () => input.workbench.layout.closePanel(input.instance.instanceId);

  const runAction = async (notification: Notification, action: NotificationAction | undefined) => {
    clearError();
    try {
      await markRead(notification);
      if (!action) {
        close();
        return;
      }

      if (action.kind === "navigate") {
        await input.workbench.navigation.openTarget(
          toWorkbenchNavigationTarget(action.target, { extensionId: notification.sourceExtensionId ?? undefined }),
        );
      } else if (action.kind === "url") {
        globalThis.open(action.href, "_blank", "noopener,noreferrer");
      } else if (input.workbench.commands.getCommand(action.command)) {
        await input.workbench.commands.executeCommand(action.command, action.params, {
          resource: notification.target ? toWorkbenchResource(notification.target, projectId) : undefined,
        });
      } else {
        const response = await executeExtensionCommand(notification.projectId, action.command, {
          params: action.params,
          resource: notification.target ?? undefined,
          source: "dashboard",
        });
        surfaceNotificationCommandResponse(input, response, notification.projectId, owner);
      }

      close();
    } catch (error) {
      showError({
        title: "Notification action failed",
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRunAction = (item: NotificationCenterItem, itemAction: NotificationCenterAction) => {
    const notification = notificationByItem(notifications, item);
    const action = notification ? actionByItem(notification, itemAction) : undefined;
    if (notification) void runAction(notification, action);
  };

  const handleActivateItem = (item: NotificationCenterItem) => {
    const notification = notificationByItem(notifications, item);
    if (notification) void runAction(notification, primaryAction(notification));
  };

  const dismissNotification = async (item: NotificationCenterItem) => {
    clearError();
    const notification = notificationByItem(notifications, item);
    if (!notification) return;
    try {
      await getApiClient().notifications.dismiss(notification.projectId, notification.id);
    } catch (error) {
      showError({
        title: "Notification update failed",
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <NotificationCenter
      autoFocus
      items={items}
      onActivateItem={handleActivateItem}
      onDismiss={(item) => void dismissNotification(item)}
      onEscape={close}
      onRunAction={handleRunAction}
      footerStart={
        <Stack gap="xs">
          {errorNotice}
          <Text textStyle="label/XS" color="fg.muted">
            {items.length === 1 ? "1 pending notification" : `${items.length} pending notifications`}
          </Text>
        </Stack>
      }
      emptyLabel="No pending notifications."
      key={dashboardWidgetIds.notificationsModal}
    />
  );
};
