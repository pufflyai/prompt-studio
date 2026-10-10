import type { ExtensionProjectContext } from "pstdio-api-contracts/extension-kernel";
import { legacyResourceOwner } from "pstdio-db";
import { type CommandRunnerEnvironment, createReadBoundary } from "pstdio-extensions";
import { emitActivityEvent } from "../../activity/activity-events";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { resolveHarnessRunParams } from "../../sessions/harness-params";
import { pendingQueuedRequests } from "../../sessions/pending-queued-requests";
import { combineQueuedRequests, updateQueuedRequest } from "../../sessions/queued-request-operations";
import { steerQueuedFollowUp } from "../../sessions/queued-steering";
import { resolveSessionCwd } from "../../sessions/resolve-session-cwd";
import { resolveSessionAttachments } from "../../sessions/session-attachments";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt, resolveHarnessInput } from "./prompt";
import { validateLegacyAnchors } from "./resource-link-policy";
import { createResourceLinksApi } from "./resource-links";

type SessionRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["sessionService"]["get"]>>>;
const toExtensionSession = (session: SessionRow, workspaceId: string | null = null) => ({
  id: session.id,
  title: session.title,
  status: session.status,
  archived: session.archived,
  agent: session.agent,
  last_selected_model: session.last_selected_model,
  workspace_id: workspaceId,
  original_session_id: session.original_session_id,
  cwd: session.cwd,
  created_at: session.created_at,
  updated_at: session.updated_at,
  last_request_started: session.last_request_started,
  last_request_ended: session.last_request_ended,
  anchors_json: session.anchors_json ?? [],
  usage: session.usage_json,
});

export const createSessionsApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; project: ExtensionProjectContext; signal?: AbortSignal },
): CommandRunnerEnvironment["sessions"] => {
  const read = createReadBoundary(input.signal);
  const getProjectSession = async (id: string) => {
    const session = await deps.sessionService.get(id);
    return session?.project_id === input.projectId ? session : null;
  };
  const requireProjectSession = async (id: string) => {
    const session = await getProjectSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    return session;
  };
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
        if (!session) return null;
        const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
        return toExtensionSession(session, workspace?.project_id === input.projectId ? workspace.id : null);
      }),
    query: async (query = {}) => {
      const workspace = query.workspaceId ? await requireProjectWorkspace(query.workspaceId) : null;
      const page = await read(() =>
        deps.sessionService.query(input.projectId, {
          ...query,
          workspaceId: workspace?.id,
        }),
      );
      return { items: page.rows.map((row) => toExtensionSession(row, row.workspace_id)), nextCursor: page.nextCursor };
    },
    list: async () => {
      const sessions = await read(() => deps.sessionService.list(input.projectId));
      return sessions.map((session) => toExtensionSession(session));
    },
    listByWorkspace: async (workspaceId) => {
      const workspace = await requireProjectWorkspace(workspaceId);
      const sessions = await read(() => deps.workspaceSessionService.listByWorkspace(workspace.id));
      return sessions.map((session) => toExtensionSession(session, workspace.id));
    },
    create: async (sessionInput) => {
      input.signal?.throwIfAborted();
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

      if (!resolvedAgent.agentId) {
        throw new Error("No harness available. Install and enable a harness extension first.");
      }

      const model = await resolveCreateSessionModel(
        harness.model,
        project,
        resolvedAgent.agentId,
        deps.harnessRegistry,
        {
          requestAgentWasOmitted: !harness.agent,
        },
      );
      // Same resolution as REST sessions: harness defaults, project defaults, then the extension's choice.
      const params = await resolveHarnessRunParams(deps, {
        projectId: input.projectId,
        agentId: resolvedAgent.agentId,
        model,
        overrides: harness.params,
      });
      const prompt = resolveExtensionPrompt(sessionInput);
      const attachments = await resolveSessionAttachments(deps, input.projectId, sessionInput.attachments);
      const cwd = await resolveSessionCwd(deps, input.projectId, workspace?.id);
      const session = await createSessionScheduler(deps).createSession({
        projectId: input.projectId,
        title: sessionInput.title,
        agentId: resolvedAgent.agentId,
        prompt,
        attachments,
        attachmentRefs: sessionInput.attachments,
        model,
        params,
        originalSessionId: sessionInput.originalSessionId,
        cwd,
        anchors: sessionInput.anchors,
        signal: input.signal,
        onCreated: async (createdSession) => {
          if (!workspace) return;

          await deps.workspaceSessionService.link(workspace.id, createdSession.id);
        },
      });
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
      return { type: "session", ...toExtensionSession(session, workspace.id) };
    },
    followup: async (followupInput) => {
      input.signal?.throwIfAborted();
      const session = await read(() => requireProjectSession(followupInput.sessionId));
      const prompt = resolveExtensionPrompt(followupInput);
      const attachments = await resolveSessionAttachments(deps, input.projectId, followupInput.attachments);
      await createSessionScheduler(deps).startOrQueueExisting({
        session,
        prompt,
        cwd: session.cwd ?? undefined,
        respectCapacity: true,
        attachments,
        attachmentRefs: followupInput.attachments,
        signal: input.signal,
      });
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
