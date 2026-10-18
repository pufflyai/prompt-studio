import type { CommandExecutionResult } from "@pstdio/sdk/api";

export type ExtensionCommandNotification = {
  level: "info" | "success" | "warning" | "error";
  title: string;
  message?: string;
  metadata: Record<string, unknown>;
};

const commandMetadata = (response: CommandExecutionResult, metadata: Record<string, unknown> = {}) => ({
  ...metadata,
  commandId: response.commandId,
  extensionId: response.extensionId,
});

export const collectExtensionCommandNotifications = (response: CommandExecutionResult) => {
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

  return notifications;
};
