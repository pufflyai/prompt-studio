import type { CommandRunnerEnvironment } from "pstdio-extensions";
import type { NotificationsRouteDeps } from "../../notifications/deps";
import { resolveByDedupeKey, transitionStatus, upsertNotification } from "../../notifications/notifications-service";
import type { ExtensionsRouteDeps } from "../deps";
import type { EnabledSource } from "./types";

type NotifyDeps = NotificationsRouteDeps;

const handleFrom = (row: { id: string; dedupe_key: string | null }) => ({
  id: row.id,
  dedupeKey: row.dedupe_key,
});

export const createNotifyApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; enabledSource: EnabledSource },
): CommandRunnerEnvironment["notify"] => {
  const notifyDeps: NotifyDeps = {
    eventBus: deps.eventBus,
    notificationsService: deps.notificationsService,
    activityEventsService: deps.activityEventsService,
    projectService: deps.projectService,
  };
  const sourceExtensionId = input.enabledSource.installedSource.id;
  const extensionId = input.enabledSource.installedSource.extension_id;

  return {
    toast: async () => {},
    action: async (actionInput) => {
      const row = await upsertNotification(notifyDeps, {
        projectId: input.projectId,
        source: "extension",
        origin: "extension",
        sourceExtensionId,
        actorType: "system",
        actorId: extensionId,
        title: actionInput.title,
        body: actionInput.body,
        kind: actionInput.kind,
        priority: actionInput.priority,
        target: actionInput.target,
        related: actionInput.related,
        actions: actionInput.actions,
        dedupeKey: actionInput.dedupeKey,
        expiresAt: actionInput.expiresAt,
        metadata: actionInput.metadata,
      });
      return handleFrom(row);
    },
    resolve: async ({ dedupeKey, status }) => {
      const row = await resolveByDedupeKey(notifyDeps, {
        projectId: input.projectId,
        dedupeKey,
        status,
      });
      return row ? handleFrom(row) : null;
    },
    dismiss: async (dismissInput) => {
      if ("id" in dismissInput) {
        const row = await transitionStatus(notifyDeps, {
          projectId: input.projectId,
          id: dismissInput.id,
          status: "dismissed",
        });
        return row ? handleFrom(row) : null;
      }
      const existing = await deps.notificationsService.findLiveByDedupeKey(input.projectId, dismissInput.dedupeKey);
      if (!existing) return null;
      const row = await transitionStatus(notifyDeps, {
        projectId: input.projectId,
        id: existing.id,
        status: "dismissed",
      });
      return row ? handleFrom(row) : null;
    },
  };
};
