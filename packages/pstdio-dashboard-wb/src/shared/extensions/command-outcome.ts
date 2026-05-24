import type { CommandExecuteResponse } from "@pstdio/sdk/api";

export type ExtensionCommandNotification = {
  level: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  metadata: Record<string, unknown>;
};

const commandMetadata = (response: CommandExecuteResponse, metadata: Record<string, unknown> = {}) => ({
  ...metadata,
  commandId: response.commandId,
  extensionId: response.extensionId,
});

export const collectExtensionCommandNotifications = (response: CommandExecuteResponse) => {
  const { outcome } = response;
  const notifications: ExtensionCommandNotification[] = [];

  for (const notice of outcome.notices ?? []) {
    notifications.push({
      level: notice.type,
      title: notice.title ?? "Extension notice",
      message: notice.message,
      metadata: commandMetadata(response, notice.metadata),
    });
  }

  if (outcome.status === "rejected") {
    notifications.push({
      level: "warning",
      title: "Extension command rejected",
      message: outcome.reason ?? outcome.code ?? "Command was rejected by middleware.",
      metadata: commandMetadata(response),
    });
  }

  if (outcome.status === "error") {
    notifications.push({
      level: "error",
      title: "Extension command failed",
      message: outcome.error?.message ?? outcome.reason ?? "Command threw an error.",
      metadata: commandMetadata(response),
    });
  }

  return notifications;
};
