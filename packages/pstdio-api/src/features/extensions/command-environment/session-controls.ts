import { approvalInputSchema, moveQueuedFollowUpInputSchema, sessionStatusSchema } from "pstdio-api-contracts";
import type { ExtensionSessionControlsApi } from "pstdio-api-contracts/extension-kernel";
import { buildDiff, emitActivityEvent, listActivityEvents } from "../../activity/activity-events";
import { toExtensionSession } from "../../sessions/extension-session";
import { getSessionHarnessCommands, invokeSessionHarnessOperation } from "../../sessions/session-harness-commands";
import { withSchedulingLock } from "../../sessions/session-scheduler-internals";
import type { ExtensionsRouteDeps } from "../deps";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { createSessionReaders } from "./session-readers";

type Controls = Omit<
  ExtensionSessionControlsApi,
  "getDraftHarnessCommands" | "uploadAttachment" | "readAttachment" | "deleteAttachment"
>;

export const createSessionControls = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const { read, requireProjectSession } = createSessionAccess(deps, input);
  const summary = async (id: string) => {
    const session = await read(() => requireProjectSession(id));
    const workspace = await read(() => deps.workspaceSessionService.getWorkspaceBySessionId(id));
    return toExtensionSession(session, workspace?.project_id === input.projectId ? workspace.id : null);
  };
  const record = (id: string, title: string, eventType: string, payload: Record<string, unknown>) =>
    emitActivityEvent(deps, {
      projectId: input.projectId,
      resourceType: "session",
      resourceId: id,
      eventType,
      summary: `${eventType === "session_archived" ? "Archived" : "Updated status for"} session ${title}`,
      payload,
    });
  return {
    ...createSessionReaders(deps, input),
    rename: async (id, title) => {
      await read(() => requireProjectSession(id));
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Session title cannot be empty.");
      await deps.sessionService.update(id, { title: trimmed });
      return summary(id);
    },
    archive: async (id) => {
      const session = await read(() => requireProjectSession(id));
      if (session.archived) throw new Error(`Session already archived: ${id}`);
      await deps.sessionService.archive(id);
      await record(id, session.title, "session_archived", { archived: buildDiff(false, true) });
      return summary(id);
    },
    delete: async (id) => {
      await read(() => requireProjectSession(id));
      const result = await deps.sessionService.remove(id, deps.fileService);
      if (result.status === "missing") throw new Error(`Session not found: ${id}`);
      if (result.status === "busy") throw new Error("Stop active or queued work before deleting.");
    },
    updateStatus: async (id, status) => {
      const session = await read(() => requireProjectSession(id));
      sessionStatusSchema.exclude(["queued"]).parse(status);
      if (session.status !== status) {
        const updated =
          status === "cancelled"
            ? await deps.sessionService.cancel(id)
            : await deps.sessionService.transitionStatus(id, status);
        if (!updated) throw new Error("Session execution changed before updating status.");
        await record(id, session.title, "session_status_updated", {
          status: buildDiff(session.status, updated.status),
          to_status: updated.status,
        });
      }
      return summary(id);
    },
    approve: async (id, request) => {
      await read(() => requireProjectSession(id));
      const approval = approvalInputSchema.parse(request);
      const entry = deps.sessionService.store.get(id);
      if (!entry) throw new Error(`No active session process for: ${id}`);
      entry.approvalService.handleResponse(approval);
    },
    listActivity: (id, query = {}) =>
      read(async () => {
        await read(() => requireProjectSession(id));
        return read(() =>
          listActivityEvents(deps, {
            projectId: input.projectId,
            resourceType: "session",
            resourceId: id,
            eventType: query.eventType ?? query.event_type,
            from: query.from,
            to: query.to,
            cursor: query.cursor,
            limit: query.limit,
          }),
        );
      }),
    removeQueuedFollowUp: async (id, position, expectedRevision) => {
      await read(() => requireProjectSession(id));
      await withSchedulingLock(async () => {
        input.signal?.throwIfAborted();
        const entry = await read(() => deps.sessionQueueEntriesService.get(position));
        if (!entry || entry.session_id !== id) throw new Error("Queued request not found.");
        if (!(await deps.sessionQueueEntriesService.removePending(position, expectedRevision)))
          throw new Error("Queued request changed or is being consumed.");
      });
    },
    moveQueuedFollowUp: async (id, queuePosition, request) => {
      await read(() => requireProjectSession(id));
      const move = moveQueuedFollowUpInputSchema.parse(request);
      return withSchedulingLock(async () => {
        input.signal?.throwIfAborted();
        const moved = await deps.sessionQueueEntriesService.movePending({
          sessionId: id,
          queuePosition,
          ...move,
        });
        if (!moved) throw new Error("The queue changed. Refresh before moving this request.");
        return { queuePosition: moved.queuePosition };
      });
    },
    getHarnessCommands: (id) =>
      read(async () => {
        await read(() => requireProjectSession(id));
        return read(() => getSessionHarnessCommands(deps, id));
      }),
    invokeHarnessOperation: async (id, operation, expectedHarnessId) => {
      await read(() => requireProjectSession(id));
      return invokeSessionHarnessOperation(deps, id, operation, expectedHarnessId, input.signal);
    },
    resolveSessionId: (request) =>
      read(async () => {
        const matches = (
          await read(() => deps.sessionService.listByAgentSession(request.harnessId, request.agentSessionId))
        ).filter((session) => session.project_id === input.projectId);
        const active = matches.filter((session) => ["in_progress", "awaiting_input"].includes(session.status));
        const candidates = active.length ? active : matches;
        if (candidates.length < 2) return candidates[0]?.id ?? null;
        const cwdMatches = request.cwd ? candidates.filter((session) => session.cwd === request.cwd) : [];
        if (cwdMatches.length === 1) return cwdMatches[0].id;
        throw new Error("Ambiguous session match");
      }),
  } satisfies Controls;
};
