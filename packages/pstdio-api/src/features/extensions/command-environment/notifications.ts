import type { NotificationStatus } from "pstdio-api-contracts";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";
import type { EnabledSource } from "./types";

export const createNotifyApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; enabledSource: EnabledSource },
): CommandRunnerEnvironment["notify"] => {
  const sourceContext = {
    source: "api" as const,
    origin: "extension" as const,
    sourceExtensionId: input.enabledSource.installedSource.id,
    actorType: "system" as const,
  };

  const resolveById = async (id: string, status: Extract<NotificationStatus, "done" | "dismissed" | "expired">) => {
    const notification = await deps.notificationService.transition(input.projectId, id, status);
    return notification ? [notification] : [];
  };

  return {
    toast: async () => {},
    action: async (notification) =>
      deps.notificationService.create({
        projectId: input.projectId,
        ...notification,
        ...sourceContext,
      }),
    resolve: async (notification) => {
      const status = notification.status ?? "done";
      if (notification.id) return resolveById(notification.id, status);
      if (notification.dedupeKey) {
        const result = await deps.notificationService.resolveByDedupeKey(
          input.projectId,
          notification.dedupeKey,
          status,
        );
        return result.notifications;
      }
      throw new Error("notify.resolve requires id or dedupeKey.");
    },
    dismiss: async (notification) => {
      if (notification.id) return resolveById(notification.id, "dismissed");
      if (notification.dedupeKey) {
        const result = await deps.notificationService.resolveByDedupeKey(
          input.projectId,
          notification.dedupeKey,
          "dismissed",
        );
        return result.notifications;
      }
      throw new Error("notify.dismiss requires id or dedupeKey.");
    },
  };
};
