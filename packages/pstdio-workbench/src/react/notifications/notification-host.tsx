import type { ToastStatusChangeDetails } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { RegisteredWorkbenchNotification, WorkbenchCore, WorkbenchNotificationAction } from "../../core";

// Bridges `workbench.notifications` into the shared `@pstdio/ui` toaster singleton. It renders
// no viewport — the embedding host renders exactly one `<Toaster />` so toasts are not
// duplicated when the workbench is mounted inside an app that already has one.
interface WorkbenchNotificationHostProps {
  workbench: WorkbenchCore;
}

const executeNotificationAction = (input: { action: WorkbenchNotificationAction; workbench: WorkbenchCore }) => {
  const { action, workbench } = input;
  void workbench.commands.executeCommand(action.commandId, action.args).catch(() => undefined);
};

export const WorkbenchNotificationHost = (props: WorkbenchNotificationHostProps) => {
  const { workbench } = props;
  const shownNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    const showNotification = (notification: RegisteredWorkbenchNotification) => {
      const action = notification.actions?.[0];
      const toastAction = action
        ? {
            label: action.title,
            onClick: () => executeNotificationAction({ action, workbench }),
          }
        : undefined;
      const toastOptions = {
        id: notification.id,
        type: notification.level,
        title: notification.title,
        description: notification.message,
        action: toastAction,
        closable: true,
        onStatusChange: (details: ToastStatusChangeDetails) => {
          if (details.status === "unmounted") workbench.notifications.dismiss(notification.id);
        },
      };

      if (shownNotificationIds.current.has(notification.id)) {
        toaster.update(notification.id, toastOptions);
        return;
      }

      shownNotificationIds.current.add(notification.id);
      toaster.create(toastOptions);
    };

    for (const notification of workbench.notifications.listNotifications()) showNotification(notification);

    const subscription = workbench.notifications.subscribe((event) => {
      if (event.type === "show") {
        showNotification(event.notification);
        return;
      }

      shownNotificationIds.current.delete(event.id);
      toaster.dismiss(event.id);
    });

    return () => {
      subscription.dispose();
      for (const id of shownNotificationIds.current) toaster.dismiss(id);
      shownNotificationIds.current.clear();
    };
  }, [workbench]);

  return null;
};
