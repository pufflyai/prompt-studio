import {
  combineQueuedFollowUpsInputSchema,
  pendingQueuedFollowUpsResponseSchema,
  queuedFollowUpUpdateResponseSchema,
  sessionDetailsSchema,
  sessionFollowUpResponseSchema,
  updateQueuedFollowUpInputSchema,
} from "pstdio-api-contracts";
import type { ExtensionProjectContext } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import { readSessionExit } from "../../../services/session-exit";
import { getDraftHarnessCommands } from "../../sessions/draft-harness-commands";
import { toExtensionSessionDetails } from "../../sessions/extension-session";
import { pendingQueuedRequests } from "../../sessions/pending-queued-requests";
import { queryExtensionSessions } from "../../sessions/query-sessions";
import { combineQueuedRequests, updateQueuedRequest } from "../../sessions/queued-request-operations";
import { steerQueuedFollowUp } from "../../sessions/queued-steering";
import { sendSessionFollowUp } from "../../sessions/send-session-followup";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt } from "./prompt";
import { validateLegacyAnchors } from "./resource-link-policy";
import { createResourceLinksApi } from "./resource-links";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { createSessionAttachments } from "./session-attachments";
import { createSessionControls } from "./session-controls";
import { createScopedSession } from "./session-create";
import { createRemoteSessionAccess } from "./session-remote";

export const createSessionsApi = (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope & { project: ExtensionProjectContext },
): CommandRunnerEnvironment["sessions"] => {
  const remote = createRemoteSessionAccess(deps, input);
  const read = createReadBoundary(input.signal);
  const { getProjectSession, requireProjectSession, requireProjectWorkspace } = createSessionAccess(deps, input);

  return {
    ...createSessionControls(deps, input),
    ...createSessionAttachments(deps, input),
    getDraftHarnessCommands: async (request) => {
      const workspace = request.workspaceId ? await requireProjectWorkspace(request.workspaceId) : undefined;
      return read(() =>
        getDraftHarnessCommands(deps, {
          project_id: input.projectId,
          agent: request.harness.harnessId,
          workspace_id: workspace?.id,
          model: request.harness.model,
          params: request.harness.params,
        }),
      );
    },
    stop: async (id) => {
      input.signal?.throwIfAborted();
      if (await remote(id, { type: "session.interrupt", id }, sessionDetailsSchema)) return;
      await read(() => requireProjectSession(id));
      if (!(await deps.sessionService.cancel(id))) throw new Error("Session execution changed before stopping.");
    },
    getQueuedFollowUps: async (id) => {
      if (await getProjectSession(id)) return read(() => pendingQueuedRequests(deps, id));
      try {
        const forwarded = await remote(
          id,
          { type: "session.queuedFollowUps", id },
          pendingQueuedFollowUpsResponseSchema,
        );
        if (forwarded) return forwarded.value;
      } catch (error) {
        input.signal?.throwIfAborted();
        const shared = await read(() => deps.personalHistoryService.queuedMessages(id, input.projectId));
        if (shared?.queue) return shared.queue;
        throw error;
      }
      throw new Error(`Session not found: ${id}`);
    },
    updateQueuedFollowUp: async (id, position, request) => {
      input.signal?.throwIfAborted();
      const forwarded = await remote(
        id,
        {
          type: "session.queueUpdate",
          id,
          queuePosition: position,
          input: updateQueuedFollowUpInputSchema.parse(request),
        },
        queuedFollowUpUpdateResponseSchema,
      );
      if (forwarded) return forwarded.value.request;
      await requireProjectSession(id);
      return updateQueuedRequest(deps, id, position, request);
    },
    combineQueuedFollowUps: async (id, position, request) => {
      input.signal?.throwIfAborted();
      const forwarded = await remote(
        id,
        {
          type: "session.queueCombine",
          id,
          queuePosition: position,
          input: combineQueuedFollowUpsInputSchema.parse(request),
        },
        queuedFollowUpUpdateResponseSchema,
      );
      if (forwarded) return forwarded.value.request;
      await requireProjectSession(id);
      return combineQueuedRequests(deps, id, position, request);
    },
    steerQueuedFollowUp: async (id, position, request) => {
      input.signal?.throwIfAborted();
      await requireProjectSession(id);
      return steerQueuedFollowUp(deps, id, position, request);
    },
    get: async (id) =>
      read(async () => {
        const session = await getProjectSession(id);
        if (!session) {
          const remote = await deps.personalHistoryService.getSession(id, input.projectId);
          return remote ? toExtensionSessionDetails(remote, remote.workspace_id) : null;
        }
        const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
        const lastExit = await readSessionExit(deps.activityEventsService, { ...session, project_id: input.projectId });
        return {
          ...toExtensionSessionDetails(session, workspace?.project_id === input.projectId ? workspace.id : null),
          lastExit,
          last_exit: lastExit,
        };
      }),
    query: (query = {}) => queryExtensionSessions(deps, input.projectId, query, input.signal),
    create: (sessionInput) => createScopedSession(deps, input, sessionInput),
    followup: async (followupInput) => {
      input.signal?.throwIfAborted();
      if (!(await getProjectSession(followupInput.sessionId))) {
        if (followupInput.expectedRun)
          throw new Error("Guarded automatic continuation is unavailable on another device.");
        await remote(
          followupInput.sessionId,
          {
            type: "session.followUp",
            id: followupInput.sessionId,
            input: {
              prompt: followupInput.prompt,
              agent: followupInput.harness?.harnessId,
              model: followupInput.harness?.model,
              params: followupInput.harness?.params,
              questionResponse: followupInput.questionResponse,
              summaryFromSessionId: followupInput.summaryFromSessionId,
              summaryFormat: followupInput.summaryFormat,
              summaryRole: followupInput.summaryRole,
              attachments: followupInput.attachments?.map(({ file_id }) => ({ fileId: file_id })),
            },
          },
          sessionFollowUpResponseSchema,
        );
        return;
      }
      const session = await read(() => requireProjectSession(followupInput.sessionId));
      if (
        followupInput.expectedRun &&
        (session.status !== followupInput.expectedRun.status ||
          session.last_request_started !== followupInput.expectedRun.startedAt ||
          session.last_request_ended !== followupInput.expectedRun.endedAt)
      )
        throw new Error("Session execution changed before continuation.");
      if (followupInput.summaryFromSessionId)
        await read(() => requireProjectSession(followupInput.summaryFromSessionId!));
      const harness = followupInput.harness;
      await sendSessionFollowUp(
        deps,
        session,
        {
          prompt: resolveExtensionPrompt(followupInput),
          agent: harness?.harnessId,
          model: harness?.model,
          params: harness?.params,
          question_response: followupInput.questionResponse,
          summary_from_session_id: followupInput.summaryFromSessionId,
          summary_format: followupInput.summaryFormat,
          summary_role: followupInput.summaryRole,
          attachments: followupInput.attachments,
        },
        { signal: input.signal, expectedRun: followupInput.expectedRun },
      );
    },
    addAnchors: async (id, anchors) => {
      await requireProjectSession(id);
      await validateLegacyAnchors(
        deps,
        { type: "session", id, projectId: input.projectId, extensionId: "pstdio" },
        anchors,
      );
      await deps.sessionService.addAnchors(id, anchors);
    },
    removeAnchors: async (id, refs) => {
      await requireProjectSession(id);
      await createResourceLinksApi(deps, input).removeAnchors(
        { type: "session", id, extensionId: "pstdio" },
        refs.map((ref) => ({ ...ref, extensionId: legacyResourceOwner(ref) })),
      );
    },
  };
};
