import type {
  ExtensionProjectContext,
  ExtensionSessionsApi,
  ResourceAnchor,
} from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { emitActivityEvent } from "../../activity/activity-events";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { resolveSessionCwd } from "../../sessions/resolve-session-cwd";
import { resolveSessionAttachments } from "../../sessions/session-attachments";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt, resolveHarnessInput } from "./prompt";

const toExtensionSession = (session: unknown) => session as Awaited<ReturnType<ExtensionSessionsApi["get"]>>;

export const createSessionsApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; project: ExtensionProjectContext; signal?: AbortSignal },
): CommandRunnerEnvironment["sessions"] => ({
  get: async (id) => {
    const session = await deps.sessionService.get(id);
    return toExtensionSession(session?.project_id === input.projectId ? session : null);
  },
  list: async () => {
    const sessions = await deps.sessionService.list(input.projectId);
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      last_request_started: session.last_request_started,
      last_request_ended: session.last_request_ended,
      updated_at: session.updated_at,
      anchors_json: (session.anchors_json ?? []) as ResourceAnchor[],
    }));
  },
  listByWorkspace: async (workspaceId) => {
    const workspace = await deps.workspaceService.get(workspaceId);
    if (!workspace || workspace.project_id !== input.projectId) throw new Error(`Workspace not found: ${workspaceId}`);
    const sessions = await deps.workspaceSessionService.listByWorkspace(workspaceId);
    return sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      created_at: session.created_at,
      updated_at: session.updated_at,
      anchors_json: (session.anchors_json ?? []) as ResourceAnchor[],
    }));
  },
  create: async (sessionInput) => {
    input.signal?.throwIfAborted();
    const workspace =
      sessionInput.workspaceId != null
        ? ((await deps.workspaceService.get(sessionInput.workspaceId)) ??
          (await deps.workspaceService.getByShorthand(input.projectId, sessionInput.workspaceId)))
        : null;
    if (sessionInput.workspaceId != null && workspace?.project_id !== input.projectId) {
      throw new Error(`Workspace not found: ${sessionInput.workspaceId}`);
    }
    const projectRepos = sessionInput.repoId ? await deps.repoService.listByProject(input.projectId) : [];
    const repoPath = projectRepos.find((repo) => repo.id === sessionInput.repoId)?.path;
    if (sessionInput.repoId && !repoPath) throw new Error(`Repository not found: ${sessionInput.repoId}`);
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

    const model = await resolveCreateSessionModel(harness.model, project, resolvedAgent.agentId, deps.harnessRegistry, {
      requestAgentWasOmitted: !harness.agent,
    });
    const prompt = await resolveExtensionPrompt(deps, input.projectId, sessionInput);
    const attachments = await resolveSessionAttachments(deps, input.projectId, sessionInput.attachments);
    const cwd = repoPath ?? (await resolveSessionCwd(deps, input.projectId, workspace?.id));
    const session = await createSessionScheduler(deps).createAndStartSession({
      projectId: input.projectId,
      title: sessionInput.title,
      agentId: resolvedAgent.agentId,
      prompt,
      attachments,
      attachmentRefs: sessionInput.attachments,
      model,
      originalSessionId: sessionInput.originalSessionId,
      cwd,
      anchors: sessionInput.anchors,
      signal: input.signal,
      onBeforeStartedHook: async (createdSession) => {
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
    return { type: "session", id: session.id, title: session.title, status: session.status };
  },
  followup: async (followupInput) => {
    input.signal?.throwIfAborted();
    const session = await deps.sessionService.get(followupInput.sessionId);
    if (!session || session.project_id !== input.projectId)
      throw new Error(`Session not found: ${followupInput.sessionId}`);
    const prompt = await resolveExtensionPrompt(deps, session.project_id ?? input.projectId, followupInput);
    const projectId = session.project_id ?? input.projectId;
    const attachments = await resolveSessionAttachments(deps, projectId, followupInput.attachments);
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
  addAnchors: async (sessionId, anchors) => {
    const session = await deps.sessionService.get(sessionId);
    if (!session || session.project_id !== input.projectId) throw new Error(`Session not found: ${sessionId}`);
    const merged = [...(session.anchors_json ?? [])];
    for (const anchor of anchors) {
      const index = merged.findIndex((candidate) => candidate.type === anchor.type && candidate.id === anchor.id);
      if (index >= 0) merged[index] = anchor;
      else merged.push(anchor);
    }
    await deps.sessionService.update(sessionId, { anchors_json: merged });
  },
});
