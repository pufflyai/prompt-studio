import type { ToastStatusChangeDetails } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useEffect, useRef } from "react";
import type { RegisteredWorkbenchNotification, WorkbenchCore, WorkbenchNotificationAction } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchSystemErrors } from "./system-errors";

// System errors belong to the status bar. Action errors belong to their view.
// Other notifications use the shared toaster rendered once by the shell.
interface WorkbenchNotificationHostProps {
  workbench: WorkbenchCore;
}

const executeNotificationAction = (input: { action: WorkbenchNotificationAction; workbench: WorkbenchCore }) => {
  const { action, workbench } = input;
  void runUserAction(workbench, action.title, () => workbench.commands.executeCommand(action.commandId, action.args));
};

export const WorkbenchNotificationHost = (props: WorkbenchNotificationHostProps) => {
  const { workbench } = props;
  const shownNotificationIds = useRef(new Set<string>());
  const notifications = useWorkbenchStore(workbench.notifications.store, (state) => state.notifications);
  const hasSystemErrors = Object.values(notifications).some(
    (notice) => notice.level === "error" && !notice.inlineTarget,
  );

  useEffect(() => {
    if (!hasSystemErrors) return;
    const id = "workbench.system-errors";
    const view = workbench.views.registerView({
      id,
      title: "System errors",
      body: {
        kind: "react",
        render: () => <WorkbenchSystemErrors workbench={workbench} />,
      },
    });
    const item = workbench.statusBar.registerItem({ id, viewId: id, slot: "trailing" });
    return () => {
      item.dispose();
      view.dispose();
    };
  }, [workbench, hasSystemErrors]);

  useEffect(() => {
    const showNotification = (notification: RegisteredWorkbenchNotification) => {
      if (notification.level === "error" || notification.inlineTarget) {
        if (shownNotificationIds.current.delete(notification.id)) toaster.dismiss(notification.id);
        return;
      }
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
