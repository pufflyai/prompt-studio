import type { ToastStatusChangeDetails } from "@chakra-ui/react";
import { useToaster } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { RegisteredWorkbenchNotification, WorkbenchCore, WorkbenchNotificationAction } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";

// System errors belong to the status bar. Action errors belong to their view.
// Other notifications use their workbench's toaster while it is active.
interface WorkbenchNotificationHostProps {
  workbench: WorkbenchCore;
}

const executeNotificationAction = (input: { action: WorkbenchNotificationAction; workbench: WorkbenchCore }) => {
  const { action, workbench } = input;
  void runUserAction(workbench, action.title, () => workbench.commands.executeCommand(action.commandId, action.args));
};

export const WorkbenchNotificationHost = (props: WorkbenchNotificationHostProps) => {
  const { workbench } = props;
  const toaster = useToaster();
  const shownNotificationIds = useRef(new Set<string>());
  useEffect(() => {
    let disposed = false;
    const showNotification = (notification: RegisteredWorkbenchNotification) => {
      if (notification.level === "error" || notification.inlineTarget) {
        if (shownNotificationIds.current.delete(notification.id)) toaster.dismiss(notification.id);
        return;
      }
      if (!workbench.activation.isActive()) return;
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
          if (
            !disposed &&
            details.status === "unmounted" &&
            workbench.notifications.store.getState().notifications[notification.id] === notification
          )
            workbench.notifications.dismiss(notification.id);
        },
      };

      if (shownNotificationIds.current.has(notification.id)) {
        toaster.update(notification.id, toastOptions);
        return;
      }

      shownNotificationIds.current.add(notification.id);
      toaster.create(toastOptions);
    };

    const refresh = () => {
      if (!workbench.activation.isActive()) {
        toaster.pause();
        return;
      }
      for (const notification of workbench.notifications.listNotifications()) showNotification(notification);
      toaster.resume();
    };
    const unsubscribeActivation = workbench.activation.store.subscribe(refresh);
    refresh();

    const subscription = workbench.notifications.subscribe((event) => {
      if (event.type === "show") {
        showNotification(event.notification);
        return;
      }

      shownNotificationIds.current.delete(event.id);
      toaster.dismiss(event.id);
    });

    return () => {
      disposed = true;
      unsubscribeActivation();
      subscription.dispose();
      for (const id of shownNotificationIds.current) toaster.dismiss(id);
      shownNotificationIds.current.clear();
    };
  }, [workbench, toaster]);

  return null;
};
