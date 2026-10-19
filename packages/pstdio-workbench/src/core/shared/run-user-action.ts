import type { NotificationRegistry } from "../registries/notifications/notification-registry";

export const reportUserActionError = (
  workbench: { notifications: Pick<NotificationRegistry, "captureActionError"> },
  label: string,
  error: unknown,
) => {
  workbench.notifications.captureActionError(label)(error);
};

// Capture the originating view before awaiting work, so switching focus cannot
// move its failure into another view. Dialogs may keep their own rejected promise.
export const runUserAction = async (
  workbench: { notifications: Pick<NotificationRegistry, "captureActionError"> },
  label: string,
  run: () => unknown,
  options?: { inlineTarget?: string; onSuccess?: () => void },
) => {
  const reportError = workbench.notifications.captureActionError(label, options?.inlineTarget);
  try {
    await run();
    options?.onSuccess?.();
  } catch (error) {
    reportError(error);
  }
};
