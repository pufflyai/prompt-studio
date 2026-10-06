import type { HarnessAttachment, HarnessParams, HarnessSession, QuestionResponse } from "pstdio-api-contracts";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { resolveHarnessWorkspace } from "./harness-workspace-readiness";
import { initializeConversation } from "./initialize-conversation";
import {
  bindSessionCancellation,
  rejectPersistedSessionCancellation,
  rejectStoreSessionCancellation,
} from "./session-request-cancellation";
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

const resolveHarness = async (deps: SpawnDeps, agentId: string, projectId?: string) => {
  const harness = await deps.harnessRegistry.get(agentId, { projectId });
  if (harness) return harness;

  if (projectId && (await deps.harnessRegistry.get(agentId))) {
    throw new Error(`Harness not enabled for this project: ${agentId}`);
  }
  throw new Error(`Harness not found: ${agentId}`);
};

const markSubmittedAttachments = (
  entry: ReturnType<SpawnDeps["sessionService"]["store"]["create"]>,
  attachments: HarnessAttachment[] | undefined,
) => {
  for (const attachment of attachments ?? []) {
    entry.submittedAttachmentFileIds.add(attachment.fileId);
  }
};

// Spawns a new harness session and tracks its lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  input.signal?.throwIfAborted();
  let harness!: Awaited<ReturnType<typeof resolveHarness>>;
  let workspace: Awaited<ReturnType<typeof resolveHarnessWorkspace>>;
  const entry = initializeConversation(
    input.sessionId,
    deps,
    async () => {
      harness = await resolveHarness(deps, input.agentId, input.projectId);
      input.signal?.throwIfAborted();
      workspace = await resolveHarnessWorkspace(deps, input, harness);
    },
    input.signal,
  );
  markSubmittedAttachments(entry, input.attachments);

  const conversation = await entry.conversationReady;
  input.signal?.throwIfAborted();

  let cwd = input.cwd;
  if (workspace) cwd = workspace.executionTarget.kind === "local" ? workspace.executionTarget.rootPath : undefined;
  const session = await harness.start(
    {
      prompt: input.prompt,
      attachments: input.attachments,
      model: input.model,
      params: input.params,
      cwd,
      workspace,
      sessionId: input.sessionId,
      events: conversation,
      questions: entry.questionService,
      signal: input.signal,
    },
    { projectId: input.projectId },
  );
  const throwIfCancelled = await bindSessionCancellation(input.signal, session, deps, input.sessionId, entry);

  if (session.agentSessionId) {
    await deps.sessionService.update(input.sessionId, { agent_session_id: session.agentSessionId });
  }
  await throwIfCancelled();
  await rejectPersistedSessionCancellation(session, deps, input.sessionId, entry);
  await throwIfCancelled();

  if (!deps.sessionService.store.setSession(input.sessionId, session, entry)) {
    await rejectStoreSessionCancellation(session, deps, input.sessionId, entry);
  }
  trackHarnessSession(
    input.sessionId,
    session,
    entry.eventStore.subscribe(),
    deps,
    {
      submittedAttachmentFileIds: submittedAttachmentFileIds(input.attachments),
      submittedQueuePosition: input.submittedQueuePosition,
    },
    entry,
  );

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
  questionResponse?: QuestionResponse;
  submittedQueuePosition?: number;
  signal?: AbortSignal;
};

// Resumes an existing harness session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  input.signal?.throwIfAborted();
  let harness!: Awaited<ReturnType<typeof resolveHarness>>;
  let workspace: Awaited<ReturnType<typeof resolveHarnessWorkspace>>;
  const entry = initializeConversation(
    input.sessionId,
    deps,
    async () => {
      harness = await resolveHarness(deps, input.agentId, input.projectId);
      input.signal?.throwIfAborted();
      workspace = await resolveHarnessWorkspace(deps, input, harness);
    },
    input.signal,
  );
  markSubmittedAttachments(entry, input.attachments);

  const conversation = await entry.conversationReady;
  input.signal?.throwIfAborted();

  const session = await harness.resume(
    {
      agentSessionId: input.agentSessionId,
      prompt: input.prompt,
      attachments: input.attachments,
      model: input.model,
      params: input.params,
      cwd: input.cwd,
      workspace: workspace!,
      sessionId: input.sessionId,
      events: conversation,
      messageOffset: conversation.getMessages().length,
      questionResponse: input.questionResponse,
      approvals: entry.approvalService,
      questions: entry.questionService,
      signal: input.signal,
    },
    { projectId: input.projectId },
  );
  const throwIfCancelled = await bindSessionCancellation(input.signal, session, deps, input.sessionId, entry);
  await throwIfCancelled();
  await rejectPersistedSessionCancellation(session, deps, input.sessionId, entry);
  await throwIfCancelled();

  if (!deps.sessionService.store.setSession(input.sessionId, session, entry)) {
    await rejectStoreSessionCancellation(session, deps, input.sessionId, entry);
  }
  trackHarnessSession(
    input.sessionId,
    session,
    entry.eventStore.subscribe(),
    deps,
    {
      submittedAttachmentFileIds: submittedAttachmentFileIds(input.attachments),
      submittedQueuePosition: input.submittedQueuePosition,
    },
    entry,
  );

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
  let harness!: Awaited<ReturnType<typeof resolveHarness>>;
  let workspace: Awaited<ReturnType<typeof resolveHarnessWorkspace>>;
  const entry = initializeConversation(
    input.sessionId,
    deps,
    async () => {
      harness = await resolveHarness(deps, input.agentId, input.projectId);
      input.signal?.throwIfAborted();
      workspace = await resolveHarnessWorkspace(deps, input, harness);
    },
    input.signal,
  );
  const conversation = await entry.conversationReady;
  input.signal?.throwIfAborted();

  if (!harness.supportsReattach) throw new Error(`Harness does not support reattach: ${input.agentId}`);
  const session = await waitForHarnessReattach(
    harness.reattach(
      {
        sessionId: input.sessionId,
        agentSessionId: input.agentSessionId,
        cwd: input.cwd,
        workspace: workspace!,
        events: conversation,
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

  if (!deps.sessionService.store.setSession(input.sessionId, session, entry)) {
    await rejectStoreSessionCancellation(session, deps, input.sessionId, entry);
  }
  trackHarnessSession(
    input.sessionId,
    session,
    entry.eventStore.subscribe(),
    deps,
    {
      submittedAttachmentFileIds: input.submittedAttachmentFileIds ?? [],
      submittedQueuePosition: input.submittedQueuePosition,
    },
    entry,
  );

  return session;
};

const submittedAttachmentFileIds = (attachments: HarnessAttachment[] | undefined) =>
  attachments?.map((attachment) => attachment.fileId) ?? [];
