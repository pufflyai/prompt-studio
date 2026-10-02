import type { NotificationRegistry } from "../registries/notifications/notification-registry";

export const reportUserActionError = (
  workbench: { notifications: Pick<NotificationRegistry, "show"> },
  label: string,
  error: unknown,
) => {
  workbench.notifications.show({
    level: "error",
    title: `${label} failed`,
    message: error instanceof Error ? error.message : String(error),
  });
};

// Use at UI entry points without an inline error display. Dialogs and reads
// retain the rejected promise so their own error display remains the owner.
export const runUserAction = async (
  workbench: { notifications: Pick<NotificationRegistry, "show"> },
  label: string,
  run: () => unknown,
) => {
  try {
    await run();
  } catch (error) {
    reportUserActionError(workbench, label, error);
  }
};
