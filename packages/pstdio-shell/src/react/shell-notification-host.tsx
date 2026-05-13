import type { ToastStatusChangeDetails } from "@chakra-ui/react";
import { Toaster, toaster } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { RegisteredShellNotification, ShellCore, ShellNotificationAction } from "../core";

interface ShellNotificationHostProps {
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
  refresh?: () => void;
}

const executeNotificationAction = (input: {
  action: ShellNotificationAction;
  shell: ShellCore;
  onCommandError?: (error: unknown) => void;
  refresh: () => void;
}) => {
  const { action, onCommandError, refresh, shell } = input;

  void shell.commands
    .executeCommand(action.commandId, action.args)
    .then(refresh)
    .catch((error) => onCommandError?.(error));
};

export const ShellNotificationHost = (props: ShellNotificationHostProps) => {
  const { shell, onCommandError, refresh = () => undefined } = props;
  const shownNotificationIds = useRef(new Set<string>());
  const onCommandErrorRef = useRef(onCommandError);
  const refreshRef = useRef(refresh);

  onCommandErrorRef.current = onCommandError;
  refreshRef.current = refresh;

  useEffect(() => {
    const showNotification = (notification: RegisteredShellNotification) => {
      const action = notification.actions?.[0];
      const toastAction = action
        ? {
            label: action.title,
            onClick: () =>
              executeNotificationAction({
                action,
                shell,
                onCommandError: onCommandErrorRef.current,
                refresh: refreshRef.current,
              }),
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

  return <Toaster />;
};
