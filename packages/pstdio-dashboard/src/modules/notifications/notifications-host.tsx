import { type NotificationActionItem, type NotificationItem, NotificationModal } from "@pstdio/ui";
import type { WorkbenchCore } from "pstdio-workbench/core";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import { subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { executeExtensionCommand } from "@/shared/extensions/api";
import {
  findActionOnNotification,
  findNotificationByItemId,
  type NotificationInboxFilter,
  readNotificationItems,
} from "./notifications-data";
import { notificationsModalStore } from "./notifications-store";

interface NotificationsHostProps {
  workbench: WorkbenchCore;
}

const useNotificationItems = (projectId: string | undefined, filter?: NotificationInboxFilter) => {
  const [items, setItems] = useState<NotificationItem[]>(() => readNotificationItems(projectId, filter));

  useEffect(() => {
    setItems(readNotificationItems(projectId, filter));
    return subscribeCollections((change) => {
      if (!change || change.table === "notifications") {
        setItems(readNotificationItems(projectId, filter));
      }
    });
  }, [projectId, filter]);

  return items;
};

const useModalOpen = () => {
  const [open, setOpen] = useState(() => notificationsModalStore.getState().open);
  useEffect(() => {
    const unsubscribe = notificationsModalStore.subscribe(() => setOpen(notificationsModalStore.getState().open));
    return () => {
      unsubscribe();
    };
  }, []);
  return open;
};

const useSelectedProjectId = (workbench: WorkbenchCore) => {
  const [projectId, setProjectId] = useState<string | undefined>(() =>
    getDashboardSelectedProjectId({ context: workbench.context }),
  );
  useEffect(() => {
    return workbench.context.store.subscribe(() => {
      setProjectId(getDashboardSelectedProjectId({ context: workbench.context }));
    });
  }, [workbench]);
  return projectId;
};

export const useDashboardNotificationItems = useNotificationItems;
export const useDashboardSelectedProjectId = useSelectedProjectId;

interface ExecuteNotificationCommandActionInput {
  workbench: WorkbenchCore;
  projectId: string | undefined;
  sourceExtensionId: string | null | undefined;
  command: string;
  params?: Record<string, unknown>;
  executeExtensionCommand?: typeof executeExtensionCommand;
}

export const executeNotificationCommandAction = async (input: ExecuteNotificationCommandActionInput) => {
  const runExtensionCommand = input.executeExtensionCommand ?? executeExtensionCommand;
  if (input.projectId && input.sourceExtensionId) {
    await runExtensionCommand(input.projectId, input.command, { params: input.params, source: "dashboard" });
    return;
  }
  await input.workbench.commands.executeCommand(input.command, input.params ?? {});
};

export const invokeNotificationAction = async (
  workbench: WorkbenchCore,
  item: NotificationItem,
  action: NotificationActionItem,
) => {
  const sdk = getApiClient();
  const notification = findNotificationByItemId(item.id);
  if (!notification) return;
  const realAction = findActionOnNotification(notification, action.id);
  if (!realAction) return;

  notificationsModalStore.close();

  try {
    if (realAction.kind === "open-resource") {
      const resource = realAction.resource;
      workbench.resources.openResource({
        kind: resource.type,
        id: resource.id,
        uri: `dashboard-workbench://${resource.type}/${resource.id}`,
        label: resource.label ?? resource.id,
        icon: undefined,
      });
      return;
    }

    if (realAction.kind === "command") {
      await executeNotificationCommandAction({
        workbench,
        projectId: notification.projectId,
        sourceExtensionId: notification.sourceExtensionId,
        command: realAction.command,
        params: realAction.params,
      });
      return;
    }

    if (realAction.kind === "url") {
      window.open(realAction.href, "_blank", "noopener,noreferrer");
    }
  } finally {
    if (notification.projectId) {
      try {
        await sdk.notifications.markRead(notification.projectId, notification.id);
      } catch {
        // ignored; user can still resolve via planner hook
      }
    }
  }
};

export const NotificationsHost = (props: NotificationsHostProps) => {
  const projectId = useSelectedProjectId(props.workbench);
  const open = useModalOpen();
  const items = useNotificationItems(projectId);

  const handleClose = () => notificationsModalStore.close();

  const handleInvokeAction = (item: NotificationItem, action: NotificationActionItem) =>
    invokeNotificationAction(props.workbench, item, action);

  return <NotificationModal open={open} items={items} onClose={handleClose} onInvokeAction={handleInvokeAction} />;
};
