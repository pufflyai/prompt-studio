import type { ExtensionProjectContext } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import { readSessionExit } from "../../../services/session-exit";
import { emitActivityEvent } from "../../activity/activity-events";
import { getDraftHarnessCommands } from "../../sessions/draft-harness-commands";
import { createSessionBodySchema } from "../../sessions/dto";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { toExtensionSession, toExtensionSessionDetails } from "../../sessions/extension-session";
import { resolveHarnessRunParams } from "../../sessions/harness-params";
import { pendingQueuedRequests } from "../../sessions/pending-queued-requests";
import { queryExtensionSessions } from "../../sessions/query-sessions";
import { combineQueuedRequests, updateQueuedRequest } from "../../sessions/queued-request-operations";
import { steerQueuedFollowUp } from "../../sessions/queued-steering";
import { resolveSessionCwd } from "../../sessions/resolve-session-cwd";
import { sendSessionFollowUp } from "../../sessions/send-session-followup";
import { withResolvedSubmittingSessionAttachments } from "../../sessions/session-attachments";
import { createSessionHarnessOperation } from "../../sessions/session-harness-commands";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt, resolveHarnessInput } from "./prompt";
import { validateLegacyAnchors } from "./resource-link-policy";
import { createResourceLinksApi } from "./resource-links";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { createSessionAttachments } from "./session-attachments";
import { createSessionControls } from "./session-controls";

export const createSessionsApi = (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope & { project: ExtensionProjectContext },
): CommandRunnerEnvironment["sessions"] => {
  const read = createReadBoundary(input.signal);
  const { getProjectSession, requireProjectSession } = createSessionAccess(deps, input);
  const getProjectWorkspace = async (id: string) => {
    const byId = await read(() => deps.workspaceService.get(id));
    if (byId?.project_id === input.projectId) return byId;
    return read(() => deps.workspaceService.getByShorthand(input.projectId, id));
  };
  const requireProjectWorkspace = async (id: string) => {
    const workspace = await getProjectWorkspace(id);
    if (!workspace || workspace.project_id !== input.projectId) throw new Error(`Workspace not found: ${id}`);
    return workspace;
  };

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
      await read(() => requireProjectSession(id));
      if (!(await deps.sessionService.cancel(id))) throw new Error("Session execution changed before stopping.");
    },
    getQueuedFollowUps: async (id) => {
      await read(() => requireProjectSession(id));
      return read(() => pendingQueuedRequests(deps, id));
    },
    updateQueuedFollowUp: async (id, position, request) => {
      input.signal?.throwIfAborted();
      await requireProjectSession(id);
      return updateQueuedRequest(deps, id, position, request);
    },
    combineQueuedFollowUps: async (id, position, request) => {
      input.signal?.throwIfAborted();
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
    create: async (sessionInput) => {
      input.signal?.throwIfAborted();
      createSessionBodySchema.parse({
        project_id: input.projectId,
        title: sessionInput.title,
        prompt: sessionInput.prompt,
        operation: sessionInput.operation,
        attachments: sessionInput.attachments,
      });
      const workspace = sessionInput.workspaceId
        ? await requireProjectWorkspace(sessionInput.workspaceId)
        : await read(() => deps.workspaceService.getDefault(input.projectId));
      if (!workspace) throw new Error("Attach a workspace before starting a session.");
      if (sessionInput.originalSessionId) await read(() => requireProjectSession(sessionInput.originalSessionId!));
      const project = await deps.projectService.get(input.projectId);
      if (!project) throw new Error(`Project not found: ${input.projectId}`);

      const harness = resolveHarnessInput(sessionInput.harness);
      const resolvedAgent = await resolveCreateSessionAgent(harness.agent, project, deps.harnessRegistry);

      if (resolvedAgent.type === "error") {
        throw new Error(resolvedAgent.error);
      }

      const agentId = resolvedAgent.agentId;
      if (!agentId) {
        throw new Error("No harness available. Install and enable a harness extension first.");
      }

      const model = await resolveCreateSessionModel(harness.model, project, agentId, deps.harnessRegistry, {
        requestAgentWasOmitted: !harness.agent,
      });
      // Same resolution as REST sessions: harness defaults, project defaults, then the extension's choice.
      const params = await resolveHarnessRunParams(deps, {
        projectId: input.projectId,
        agentId,
        model,
        overrides: harness.params,
      });
      const prompt = resolveExtensionPrompt(sessionInput);
      const cwd = await resolveSessionCwd(deps, input.projectId, workspace?.id);
      const onCreated = async (createdSession: { id: string }) => {
        await deps.workspaceSessionService.link(workspace.id, createdSession.id);
      };
      const creation = sessionInput.operation
        ? await createSessionHarnessOperation(
            deps,
            {
              project_id: input.projectId,
              title: sessionInput.title,
              agent: agentId,
              last_selected_model: model,
              params_json: params,
              original_session_id: sessionInput.originalSessionId,
              cwd,
              anchors: sessionInput.anchors,
            },
            sessionInput.operation,
            onCreated,
            input.signal,
          ).then((session) => ({ session, operationResult: session.operation_result }))
        : await withResolvedSubmittingSessionAttachments(
            deps,
            input.projectId,
            sessionInput.attachments,
            async (attachments) => {
              input.signal?.throwIfAborted();
              return createSessionScheduler(deps).createSession({
                projectId: input.projectId,
                title: sessionInput.title,
                agentId,
                prompt,
                attachments,
                attachmentRefs: sessionInput.attachments,
                model,
                params,
                originalSessionId: sessionInput.originalSessionId,
                cwd,
                anchors: sessionInput.anchors,
                signal: input.signal,
                onCreated,
              });
            },
          ).then((session) => ({ session, operationResult: undefined }));
      const { session, operationResult } = creation;
      await emitActivityEvent(deps, {
        projectId: input.projectId,
        resourceType: "session",
        resourceId: session.id,
        eventType: "session_created",
        summary: `Created session ${session.title}`,
        payload: {
          status: session.status,
          workspace_id: workspace?.id ?? null,
        },
      });
      return {
        type: "session",
        ...toExtensionSession(session, workspace.id),
        ...(operationResult ? { operationResult } : {}),
      };
    },
    followup: async (followupInput) => {
      input.signal?.throwIfAborted();
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
