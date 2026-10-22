import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { collectExtensionCommandNotifications } from "./command-outcome";

interface CommandNotice {
  type: "info" | "success" | "warning" | "error";
  title: string;
  description?: string;
}

export const surfaceWebviewCommandOutcome = (
  response: CommandExecutionResult,
  show: (notice: CommandNotice) => unknown,
) => {
  for (const notification of collectExtensionCommandNotifications(response)) {
    show({ type: notification.level, title: notification.title, description: notification.message });
  }
};
