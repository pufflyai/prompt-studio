import type { SessionMessage } from "pstdio-api-contracts";
import type { SessionsRouteDeps } from "./deps";
import { getSessionHarness } from "./get-session-harness";
import { getSessionHistory } from "./session-history";
import { persistSessionMessages } from "./session-messages";
import { withSchedulingLock } from "./session-scheduler-internals";
import { toHarnessWorkspaceContext } from "./session-workspace-context";

export class SessionForkError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

const selectForkMessages = (history: SessionMessage[], messageId?: string) => {
  const boundary =
    messageId === undefined ? history.length - 1 : history.findIndex((message) => message.id === messageId);
  if (messageId !== undefined && (boundary < 0 || history[boundary].role !== "assistant"))
    throw new SessionForkError("Choose an agent reply to fork from.", 400);
  return structuredClone(history.slice(0, boundary + 1));
};

const assertIndependentFork = (sourceId: string, forkId: string) => {
  if (!forkId || forkId === sourceId) throw new Error("The harness did not create an independent conversation.");
};

const assertSessionIdle = async (deps: SessionsRouteDeps, id: string, status: string) => {
  const owner = deps.sessionService.store.get(id);
  const hasWork = await deps.sessionQueueEntriesService.hasEntries(id);
  if (
    ["in_progress", "awaiting_input", "queued"].includes(status) ||
    owner?.session ||
    owner?.controlInvocations.size ||
    owner?.checkpointPromise ||
    hasWork
  )
    throw new SessionForkError("Finish or stop pending work before forking.", 409);
};

const resolveForkWorkspace = async (deps: SessionsRouteDeps, id: string, cwdRequirement: "required" | "optional") => {
  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(id);
  if (
    !workspace ||
    workspace.deleted_at ||
    workspace.archived ||
    workspace.provider_operation_kind ||
    workspace.initializing ||
    workspace.setup_error ||
    (workspace.provider_state && workspace.provider_state !== "ready")
  ) {
    throw new SessionForkError("The workspace is not ready.", 409);
  }
  const context = toHarnessWorkspaceContext(workspace, cwdRequirement);
  if (context?.executionTarget.kind === "remote" && cwdRequirement === "required") {
    throw new SessionForkError("This harness requires a local workspace.", 400);
  }
  return { workspace, context };
};

export const forkSession = async (deps: SessionsRouteDeps, id: string, messageId?: string) => {
  let createdId: string | undefined;
  try {
    return await withSchedulingLock(async () => {
      const source = await deps.sessionService.get(id);
      if (!source) throw new SessionForkError("Session not found.", 404);
      if (!source.project_id || !source.agent) throw new SessionForkError("This session has no agent or project.", 400);
      await assertSessionIdle(deps, id, source.status);
      const harness = await getSessionHarness(deps.harnessRegistry, source);
      if (!harness?.supportsFork)
        throw new SessionForkError("This harness does not support forking conversations.", 400);
      if (!source.agent_session_id) throw new SessionForkError("Send a message before forking this conversation.", 409);
      const { workspace, context } = await resolveForkWorkspace(deps, id, harness.cwdRequirement);
      const messages = selectForkMessages(await getSessionHistory(id, deps), messageId);
      const native = await harness.fork(
        {
          sessionId: id,
          agentSessionId: source.agent_session_id,
          messageId,
          cwd: source.cwd ?? undefined,
          workspace: context,
          model: source.last_selected_model,
          params: source.params_json ?? undefined,
        },
        { projectId: source.project_id ?? undefined },
      );
      assertIndependentFork(source.agent_session_id, native.agentSessionId);
      const nativeMessages = await harness.getMessages(
        {
          agentSessionId: native.agentSessionId,
          cwd: source.cwd ?? undefined,
          workspace: context,
        },
        { projectId: source.project_id },
      );
      // Providers may assign new message IDs while copying their transcript.
      const recovered = await harness.recoverMessages(
        { knownMessages: messages, nativeMessages, cwd: source.cwd ?? undefined, workspace: context },
        { projectId: source.project_id },
      );
      if (recovered.kind === "conflict")
        throw new SessionForkError("The copied conversation history could not be reconciled.", 409);
      // A workspace can be removed while the provider copies its history.
      await resolveForkWorkspace(deps, id, harness.cwdRequirement);
      const fork = await deps.sessionService.create(
        {
          project_id: source.project_id,
          title: `${source.title} (fork)`,
          agent: source.agent,
          original_session_id: id,
          cwd: source.cwd ?? undefined,
          last_selected_model: source.last_selected_model ?? undefined,
          params_json: source.params_json ?? undefined,
          status: "completed",
        },
        { emitStartedHook: false },
      );
      createdId = fork.id;
      await deps.sessionService.update(fork.id, { agent_session_id: native.agentSessionId });
      await persistSessionMessages(fork.id, recovered.messages, deps);
      await deps.workspaceSessionService.link(workspace.id, fork.id);
      const session = (await deps.sessionService.get(fork.id))!;
      await resolveForkWorkspace(deps, id, harness.cwdRequirement);
      return { session, workspaceId: workspace.id };
    });
  } catch (error) {
    // Remove incomplete host data after releasing the scheduler lock; removal acquires that same lock.
    if (createdId) await deps.sessionService.remove(createdId, deps.fileService);
    throw error;
  }
};
