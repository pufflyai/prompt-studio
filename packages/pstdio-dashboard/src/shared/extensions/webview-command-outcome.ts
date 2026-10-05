import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { collectExtensionCommandNotifications } from "./command-outcome";

interface CommandNotice {
  type: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
}

export const surfaceWebviewCommandOutcome = (
  response: CommandExecuteResponse,
  show: (notice: CommandNotice) => unknown,
) => {
  for (const notification of collectExtensionCommandNotifications(response)) {
    show({ type: notification.level, title: notification.title, description: notification.message });
  }
  const { outcome } = response;
  if (outcome.status === "success") return;
  show({
    type: outcome.status === "rejected" ? "warning" : "error",
    title: outcome.status === "rejected" ? "Extension command rejected" : "Extension command failed",
    description: outcome.error?.message ?? outcome.reason ?? outcome.code ?? "Command failed.",
  });
};
