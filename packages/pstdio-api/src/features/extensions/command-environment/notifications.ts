import type { NotificationStatus } from "pstdio-api-contracts";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export const createNotifyApi = (
  deps: Pick<ExtensionsRouteDeps, "notificationService">,
  input: { projectId: string; enabledSource: { installedSource: { id: string } } },
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
    setStatus: async (id, status) => {
      if (status !== "done" && status !== "dismissed") throw new Error("Authors may set done or dismissed only.");
      return deps.notificationService.setStatus(input.projectId, id, { status });
    },
    setStatusByKey: async (key, status) => {
      if (status !== "done" && status !== "dismissed") throw new Error("Authors may set done or dismissed only.");
      return deps.notificationService.setStatusByKey(input.projectId, key, { status });
    },
    action: async (notification) =>
      deps.notificationService.create({
        projectId: input.projectId,
        ...notification,
        ...sourceContext,
      }),
    resolve: async (notification) => {
      const status = notification.status ?? "done";
      if (notification.id) return resolveById(notification.id, status);
      if (notification.dedupeKey !== undefined) {
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
      if (notification.dedupeKey !== undefined) {
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
