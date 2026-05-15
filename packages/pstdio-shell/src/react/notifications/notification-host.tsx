import type { ToastStatusChangeDetails } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { RegisteredShellNotification, ShellCore, ShellNotificationAction } from "../../core";

// Bridges `shell.notifications` into the shared `@pstdio/ui` toaster singleton. It renders
// no viewport — the embedding host renders exactly one `<Toaster />` so toasts are not
// duplicated when the shell is mounted inside an app that already has one.
interface ShellNotificationHostProps {
  shell: ShellCore;
}

const executeNotificationAction = (input: { action: ShellNotificationAction; shell: ShellCore }) => {
  const { action, shell } = input;
  void shell.commands.executeCommand(action.commandId, action.args).catch(() => undefined);
};

export const ShellNotificationHost = (props: ShellNotificationHostProps) => {
  const { shell } = props;
  const shownNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    const showNotification = (notification: RegisteredShellNotification) => {
      const action = notification.actions?.[0];
      const toastAction = action
        ? {
            label: action.title,
            onClick: () => executeNotificationAction({ action, shell }),
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
          if (details.status === "unmounted") shell.notifications.dismiss(notification.id);
        },
      };

      if (shownNotificationIds.current.has(notification.id)) {
        toaster.update(notification.id, toastOptions);
        return;
      }

      shownNotificationIds.current.add(notification.id);
      toaster.create(toastOptions);
    };

    for (const notification of shell.notifications.listNotifications()) showNotification(notification);

    const subscription = shell.notifications.subscribe((event) => {
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
  }, [shell]);

  return null;
};
