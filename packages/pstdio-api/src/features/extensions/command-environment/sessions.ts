import type { ExtensionProjectContext, ExtensionSessionsApi } from "pstdio-api-contracts/extension-kernel";
import type { CommandRunnerEnvironment } from "pstdio-extensions";
import { emitActivityEvent } from "../../activity/activity-events";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { resolveSessionCwd } from "../../sessions/resolve-session-cwd";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt, resolveHarnessInput } from "./prompt";

const toExtensionSession = (session: unknown) => session as Awaited<ReturnType<ExtensionSessionsApi["get"]>>;

export const createSessionsApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; project: ExtensionProjectContext },
): CommandRunnerEnvironment["sessions"] => ({
  get: async (id) => toExtensionSession(await deps.sessionService.get(id)),
  create: async (sessionInput) => {
    const workspace =
      sessionInput.workspaceId != null
        ? ((await deps.workspaceService.get(sessionInput.workspaceId)) ??
          (await deps.workspaceService.getByShorthand(input.projectId, sessionInput.workspaceId)))
        : null;
    const repoPath = sessionInput.repoId ? (await deps.repoService.get(sessionInput.repoId))?.path : undefined;
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
    const cwd = repoPath ?? (await resolveSessionCwd(deps, input.projectId, workspace?.id));
    const session = await createSessionScheduler(deps).createAndStartSession({
      projectId: input.projectId,
      title: sessionInput.title,
      agentId: resolvedAgent.agentId,
      prompt,
      model,
      originalSessionId: sessionInput.originalSessionId,
      cwd,
      anchors: sessionInput.anchors,
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
    const session = await deps.sessionService.get(followupInput.sessionId);
    if (!session) throw new Error(`Session not found: ${followupInput.sessionId}`);
    if (!session.cwd) throw new Error(`Session has no cwd: ${followupInput.sessionId}`);
    const prompt = await resolveExtensionPrompt(deps, session.project_id ?? input.projectId, followupInput);
    await createSessionScheduler(deps).startOrQueueExisting({
      session,
      prompt,
      cwd: session.cwd,
      respectCapacity: true,
    });
  },
});
