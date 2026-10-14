import { withSchedulingLock } from "../features/sessions/session-scheduler-internals";
import type { ActiveSession, createSessionStore } from "../features/sessions/session-store";
import type { createFileService } from "./file-service";
import { publishResourceAnchorChanges } from "./resource-anchor-events";
import type { SessionServiceDeps } from "./session-service";

const ownerIsBusy = async (owner: ActiveSession | null) => {
  if (!owner) return false;
  if (owner.session || owner.controlInvocations.size || owner.checkpointPromise) return true;
  // Do not wait for initialization while holding the scheduler lock. A settled,
  // closed conversation can be retained after a failed checkpoint; it is idle.
  const conversation = await Promise.race([owner.conversationReady, Promise.resolve(null)]).catch(() => null);
  return !conversation?.closed || Boolean(owner.session || owner.controlInvocations.size || owner.checkpointPromise);
};

export const removeSession = (
  deps: SessionServiceDeps,
  store: ReturnType<typeof createSessionStore>,
  id: string,
  files: Pick<ReturnType<typeof createFileService>, "prepareRemoval">,
) =>
  withSchedulingLock(async () => {
    const owner = store.get(id);
    if (await ownerIsBusy(owner)) return { status: "busy" as const };
    let checkpoint: Awaited<ReturnType<typeof files.prepareRemoval>> | undefined;
    let result: Awaited<ReturnType<typeof deps.sessionsDb.remove>>;
    try {
      result = await deps.sessionsDb.remove(id, async (file) => {
        checkpoint = await files.prepareRemoval(file);
      });
    } catch (error) {
      checkpoint?.rollback();
      throw error;
    }
    if (result.status !== "removed") return result;
    if (owner) store.remove(id, owner);
    checkpoint?.commit();
    publishResourceAnchorChanges(deps.eventBus, result.changes, "remove");
    for (const link of result.links) deps.eventBus.emit("workspace_sessions", "delete", { id: link.id });
    for (const row of result.sessionSources) deps.eventBus.emit("sessions", "set", row);
    for (const row of result.workspaceSources) deps.eventBus.emit("workspaces", "set", row);
    deps.eventBus.emit("sessions", "delete", { id });
    deps.eventBus.emit("resource_events", "set", {
      id: crypto.randomUUID(),
      resource: { type: "session", id, extensionId: "pstdio", projectId: result.session.project_id },
    });
    return result;
  });
