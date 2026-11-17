import type { ExtensionSessionsApi } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary } from "pstdio-extensions";
import { emitActivityEvent } from "../../activity/activity-events";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import { createSessionBodySchema } from "../../sessions/dto";
import { resolveCreateSessionAgent, resolveCreateSessionModel } from "../../sessions/endpoints/resolve-create-session";
import { needsProjectFolder } from "../../sessions/endpoints/resolve-create-workspace";
import { toExtensionSession } from "../../sessions/extension-session";
import { resolveHarnessRunParams } from "../../sessions/harness-params";
import { resolveSessionCwd } from "../../sessions/resolve-session-cwd";
import { withResolvedSubmittingSessionAttachments } from "../../sessions/session-attachments";
import { createSessionHarnessOperation } from "../../sessions/session-harness-commands";
import { createSessionScheduler } from "../../sessions/session-scheduler";
import type { ExtensionsRouteDeps } from "../deps";
import { resolveExtensionPrompt, resolveHarnessInput } from "./prompt";
import { createSessionAccess, type SessionApiScope } from "./session-access";
import { createRemoteSession } from "./session-remote";

export const createScopedSession = async (
  deps: ExtensionsRouteDeps,
  input: SessionApiScope,
  sessionInput: Parameters<ExtensionSessionsApi["create"]>[0],
) => {
  const read = createReadBoundary(input.signal);
  const { requireProjectSession, requireProjectWorkspace } = createSessionAccess(deps, input);

  input.signal?.throwIfAborted();
  const remote = await createRemoteSession(deps, input, sessionInput);
  if (remote) return remote;
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

  if (needsProjectFolder(workspace, resolvedAgent.harness)) throw new ProjectFolderMissingError();

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
            workspaceId: workspace.id,
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
    type: "session" as const,
    ...toExtensionSession(session, workspace.id),
    ...(operationResult ? { operationResult } : {}),
  };
};
