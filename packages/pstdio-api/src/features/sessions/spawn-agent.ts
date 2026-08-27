import type {
  ApprovalRequest,
  HarnessAttachment,
  HarnessParams,
  HarnessSession,
  QuestionResponse,
} from "pstdio-api-contracts";
import { sessionLogger } from "../../lib/logger";
import { waitForWorkspaceReady } from "../workspaces/wait-for-ready";
import type { SessionsRouteDeps } from "./deps";
import {
  bindSessionCancellation,
  rejectPersistedSessionCancellation,
  rejectStoreSessionCancellation,
} from "./session-request-cancellation";
import { toHarnessWorkspaceContext } from "./session-workspace-context";
import { trackHarnessSession } from "./track-harness-session";

type SpawnInput = {
  sessionId: string;
  projectId?: string;
  agentId: string;
  prompt: string;
  attachments?: HarnessAttachment[];
  title?: string;
  model?: string;
  params?: HarnessParams;
  cwd?: string;
  submittedQueuePosition?: number;
  signal?: AbortSignal;
};

type SpawnDeps = Pick<SessionsRouteDeps, "harnessRegistry" | "eventBus" | "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
  sessionQueueEntriesService?: SessionsRouteDeps["sessionQueueEntriesService"];
  workspaceSessionService?: SessionsRouteDeps["workspaceSessionService"];
};

export class WorkspaceSessionNotReadyError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const resolveHarness = async (deps: SpawnDeps, agentId: string, projectId?: string) => {
  const harness = await deps.harnessRegistry.get(agentId, { projectId });
  if (harness) return harness;

  if (projectId && (await deps.harnessRegistry.get(agentId))) {
    throw new Error(`Harness not enabled for this project: ${agentId}`);
  }
  throw new Error(`Harness not found: ${agentId}`);
};

const createStoreEntry = (deps: SpawnDeps, sessionId: string) => {
  const entry = deps.sessionService.store.create(sessionId, (request: ApprovalRequest) => {
    entry.eventStore.push({ op: "add", path: "/approval_request", value: request });
  });
  return entry;
};

const markSubmittedAttachments = (
  entry: ReturnType<SpawnDeps["sessionService"]["store"]["create"]>,
  attachments: HarnessAttachment[] | undefined,
) => {
  for (const attachment of attachments ?? []) {
    entry.submittedAttachmentFileIds.add(attachment.fileId);
  }
};

// Hard gate shared by every harness entrypoint (start, resume, reattach): a worktree must
// finish syncing its `.claude/skills` before the harness boots, or skills read as "Unknown".
// Resume and reattach can land mid re-sync just like a fresh start, so all three wait here —
// including the startup orphan-recovery path, whose deps now carry `workspaceSessionService`
// so reattach enforces the gate instead of bypassing it.
// If provisioning is still running past the cap, or it failed (which clears `initializing` but
// records `setup_error`), fail loudly instead of launching into a half-synced tree.
const ensureWorkspaceReady = async (deps: SpawnDeps, sessionId: string) => {
  if (!deps.workspaceSessionService) return null;

  const workspace = await waitForWorkspaceReady({ workspaceSessionService: deps.workspaceSessionService }, sessionId);
  if (workspace?.initializing) {
    throw new WorkspaceSessionNotReadyError(
      `Workspace ${workspace.id} is still provisioning; refusing to start the session.`,
      true,
    );
  }
  if (workspace?.setup_error) {
    throw new WorkspaceSessionNotReadyError(
      `Workspace ${workspace.id} failed to provision: ${workspace.setup_error}`,
      false,
    );
  }
  if (workspace?.provider_state && workspace.provider_state !== "ready") {
    const message = workspace.provider_error_json?.message ?? `provider state is ${workspace.provider_state}`;
    const retryable =
      workspace.provider_error_json?.retryable === true ||
      workspace.provider_state === "provisioning" ||
      workspace.provider_state === "provider_missing";
    throw new WorkspaceSessionNotReadyError(`Workspace ${workspace.id} is not ready: ${message}`, retryable);
  }
  return workspace;
};

const resolveHarnessWorkspace = async (
  deps: SpawnDeps,
  input: { sessionId: string; cwd?: string },
  harness: { cwdRequirement: "required" | "optional" },
) => {
  const workspace = await ensureWorkspaceReady(deps, input.sessionId);
  const context = toHarnessWorkspaceContext(workspace, input.cwd);
  if (workspace?.execution_kind === "remote" && harness.cwdRequirement === "required") {
    throw new Error(`Harness requires a local cwd and cannot run remote workspace ${workspace.id}.`);
  }
  return context;
};

// Spawns a new harness session and tracks its lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  input.signal?.throwIfAborted();
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  input.signal?.throwIfAborted();
  const entry = createStoreEntry(deps, input.sessionId);
  markSubmittedAttachments(entry, input.attachments);

  const workspace = await resolveHarnessWorkspace(deps, input, harness);
  input.signal?.throwIfAborted();

  const session = await harness.start(
    {
      prompt: input.prompt,
      attachments: input.attachments,
      model: input.model,
      params: input.params,
      cwd: input.cwd,
      workspace,
      sessionId: input.sessionId,
      events: entry.eventStore,
      signal: input.signal,
    },
    { projectId: input.projectId },
  );
  const throwIfCancelled = await bindSessionCancellation(input.signal, session, deps, input.sessionId);

  if (session.agentSessionId) {
    await deps.sessionService.update(input.sessionId, { agent_session_id: session.agentSessionId });
  }
  await throwIfCancelled();
  await rejectPersistedSessionCancellation(session, deps, input.sessionId);
  await throwIfCancelled();

  if (!deps.sessionService.store.setSession(input.sessionId, session)) {
    await rejectStoreSessionCancellation(session, deps, input.sessionId);
  }
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps, {
    submittedAttachmentFileIds: submittedAttachmentFileIds(input.attachments),
    submittedQueuePosition: input.submittedQueuePosition,
  });

  return session;
};

type ResumeInput = {
  sessionId: string;
  projectId?: string;
  agentSessionId: string;
  agentId: string;
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string;
  params?: HarnessParams;
  cwd?: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
  submittedQueuePosition?: number;
  signal?: AbortSignal;
};

// Resumes an existing harness session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  input.signal?.throwIfAborted();
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  input.signal?.throwIfAborted();
  const entry = createStoreEntry(deps, input.sessionId);
  markSubmittedAttachments(entry, input.attachments);

  const workspace = await resolveHarnessWorkspace(deps, input, harness);
  input.signal?.throwIfAborted();

  // Resume streams emit index-based message patches, so we align indices with existing history.
  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await harness.getMessages(
        { agentSessionId: input.agentSessionId, cwd: input.cwd, workspace },
        { projectId: input.projectId },
      );
      messageOffset = messages.length;
    } catch {
      messageOffset = 0;
    }
  }

  const session = await harness.resume(
    {
      agentSessionId: input.agentSessionId,
      prompt: input.prompt,
      attachments: input.attachments,
      model: input.model,
      params: input.params,
      cwd: input.cwd,
      workspace,
      sessionId: input.sessionId,
      events: entry.eventStore,
      messageOffset,
      questionResponse: input.questionResponse,
      approvals: entry.approvalService,
      signal: input.signal,
    },
    { projectId: input.projectId },
  );
  const throwIfCancelled = await bindSessionCancellation(input.signal, session, deps, input.sessionId);
  await throwIfCancelled();
  await rejectPersistedSessionCancellation(session, deps, input.sessionId);
  await throwIfCancelled();

  if (!deps.sessionService.store.setSession(input.sessionId, session)) {
    await rejectStoreSessionCancellation(session, deps, input.sessionId);
  }
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps, {
    submittedAttachmentFileIds: submittedAttachmentFileIds(input.attachments),
    submittedQueuePosition: input.submittedQueuePosition,
  });

  return session;
};

type ReattachInput = {
  sessionId: string;
  projectId?: string;
  agentSessionId: string;
  agentId: string;
  cwd?: string;
  submittedAttachmentFileIds?: string[];
  submittedQueuePosition?: number;
  signal?: AbortSignal;
};

const stopSessionReturnedAfterReattachAbort = (session: HarnessSession, sessionId: string) => {
  void Promise.resolve()
    .then(() => session.stop())
    .catch((error) =>
      sessionLogger.error(
        { err: error, event: "session.reattach_late_stop.failed", session_id: sessionId },
        "Failed to stop a harness session returned after reattach was aborted",
      ),
    );
};

const waitForHarnessReattach = (task: Promise<HarnessSession>, sessionId: string, signal?: AbortSignal) => {
  if (!signal) return task;
  let settled = false;
  return new Promise<HarnessSession>((resolve, reject) => {
    const finish = (settle: () => void) => {
      if (settled) return false;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      settle();
      return true;
    };
    const onAbort = () => finish(() => reject(signal.reason));
    task.then(
      (session) => {
        if (!finish(() => resolve(session))) stopSessionReturnedAfterReattachAbort(session, sessionId);
      },
      (error) => finish(() => reject(error)),
    );
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
};

// Reattaches to a harness session that was orphaned (e.g. by a server restart)
export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  input.signal?.throwIfAborted();
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  if (!harness.supportsReattach) throw new Error(`Harness does not support reattach: ${input.agentId}`);

  const entry = createStoreEntry(deps, input.sessionId);

  const workspace = await resolveHarnessWorkspace(deps, input, harness);
  input.signal?.throwIfAborted();

  const session = await waitForHarnessReattach(
    harness.reattach(
      {
        sessionId: input.sessionId,
        agentSessionId: input.agentSessionId,
        cwd: input.cwd,
        workspace,
        events: entry.eventStore,
        signal: input.signal,
      },
      { projectId: input.projectId },
    ),
    input.sessionId,
    input.signal,
  );
  if (input.signal?.aborted) {
    stopSessionReturnedAfterReattachAbort(session, input.sessionId);
    input.signal.throwIfAborted();
  }

  deps.sessionService.store.setSession(input.sessionId, session);
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps, {
    submittedAttachmentFileIds: input.submittedAttachmentFileIds ?? [],
    submittedQueuePosition: input.submittedQueuePosition,
  });

  return session;
};

const submittedAttachmentFileIds = (attachments: HarnessAttachment[] | undefined) =>
  attachments?.map((attachment) => attachment.fileId) ?? [];
