import type {
  ApprovalRequest,
  HarnessAttachment,
  HarnessParams,
  HarnessSession,
  QuestionResponse,
  SessionMessage,
} from "pstdio-api-contracts";
import { resolveHarnessExit } from "pstdio-api-runtime-host";
import { sessionLogger } from "../../lib/logger";
import { waitForWorkspaceReady } from "../workspaces/wait-for-ready";
import type { SessionsRouteDeps } from "./deps";
import { persistSessionMessages } from "./session-messages";

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
};

type SpawnDeps = Pick<SessionsRouteDeps, "harnessRegistry" | "eventBus" | "fileService" | "sessionService"> & {
  processExitTimeoutMs?: number;
  sessionQueueEntriesService?: SessionsRouteDeps["sessionQueueEntriesService"];
  workspaceSessionService?: SessionsRouteDeps["workspaceSessionService"];
};

const DEFAULT_PROCESS_EXIT_TIMEOUT_MS = 10 * 60 * 1000;

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
  if (!deps.workspaceSessionService) return;

  const workspace = await waitForWorkspaceReady({ workspaceSessionService: deps.workspaceSessionService }, sessionId);
  if (workspace?.initializing) {
    throw new Error(`Workspace ${workspace.id} is still provisioning; refusing to start the session.`);
  }
  if (workspace?.setup_error) {
    throw new Error(`Workspace ${workspace.id} failed to provision: ${workspace.setup_error}`);
  }
  if (workspace?.provider_state && workspace.provider_state !== "ready") {
    const message = workspace.provider_error_json?.message ?? `provider state is ${workspace.provider_state}`;
    throw new Error(`Workspace ${workspace.id} is not ready: ${message}`);
  }
  if (workspace?.execution_kind === "remote") {
    throw new Error(`Workspace ${workspace.id} cannot run a local harness session.`);
  }
};

// Spawns a new harness session and tracks its lifecycle
export const spawnAgentSession = async (input: SpawnInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  const entry = createStoreEntry(deps, input.sessionId);
  markSubmittedAttachments(entry, input.attachments);

  await ensureWorkspaceReady(deps, input.sessionId);

  const session = await harness.start(
    {
      prompt: input.prompt,
      attachments: input.attachments,
      model: input.model,
      params: input.params,
      cwd: input.cwd,
      sessionId: input.sessionId,
      events: entry.eventStore,
    },
    { projectId: input.projectId },
  );

  if (session.agentSessionId) {
    await deps.sessionService.update(input.sessionId, { agent_session_id: session.agentSessionId });
  }

  deps.sessionService.store.setSession(input.sessionId, session);
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
};

// Resumes an existing harness session with a follow-up prompt
export const resumeAgentSession = async (input: ResumeInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  const entry = createStoreEntry(deps, input.sessionId);
  markSubmittedAttachments(entry, input.attachments);

  await ensureWorkspaceReady(deps, input.sessionId);

  // Resume streams emit index-based message patches, so we align indices with existing history.
  let messageOffset = input.messageOffset;
  if (messageOffset === undefined) {
    try {
      const messages = await harness.getMessages(
        { agentSessionId: input.agentSessionId, cwd: input.cwd },
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
      sessionId: input.sessionId,
      events: entry.eventStore,
      messageOffset,
      questionResponse: input.questionResponse,
      approvals: entry.approvalService,
    },
    { projectId: input.projectId },
  );

  deps.sessionService.store.setSession(input.sessionId, session);
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
};

// Reattaches to a harness session that was orphaned (e.g. by a server restart)
export const reattachAgentSession = async (input: ReattachInput, deps: SpawnDeps) => {
  const harness = await resolveHarness(deps, input.agentId, input.projectId);
  if (!harness.supportsReattach) throw new Error(`Harness does not support reattach: ${input.agentId}`);

  const entry = createStoreEntry(deps, input.sessionId);

  await ensureWorkspaceReady(deps, input.sessionId);

  const session = await harness.reattach(
    {
      sessionId: input.sessionId,
      agentSessionId: input.agentSessionId,
      cwd: input.cwd,
      events: entry.eventStore,
    },
    { projectId: input.projectId },
  );

  deps.sessionService.store.setSession(input.sessionId, session);
  trackHarnessSession(input.sessionId, session, entry.eventStore.subscribe(), deps, {
    submittedAttachmentFileIds: input.submittedAttachmentFileIds ?? [],
    submittedQueuePosition: input.submittedQueuePosition,
  });

  return session;
};

const submittedAttachmentFileIds = (attachments: HarnessAttachment[] | undefined) =>
  attachments?.map((attachment) => attachment.fileId) ?? [];

const messagesReferenceFile = (messages: SessionMessage[], fileId: string) =>
  messages.some((message) => message.parts.some((part) => part.type === "file" && part.fileId === fileId));

const messagesReferenceSubmittedAttachments = (messages: SessionMessage[], fileIds: string[]) =>
  fileIds.every((fileId) => messagesReferenceFile(messages, fileId));

const trackHarnessSession = (
  sessionId: string,
  session: Pick<HarnessSession, "done" | "stop" | "timeoutStrategy">,
  activity: AsyncIterable<unknown>,
  deps: SpawnDeps,
  submitted?: { submittedAttachmentFileIds: string[]; submittedQueuePosition?: number },
) => {
  resolveHarnessExit({
    session,
    activity,
    timeoutMs: deps.processExitTimeoutMs ?? DEFAULT_PROCESS_EXIT_TIMEOUT_MS,
    onTimeout: () =>
      sessionLogger.error(
        {
          event: "session.process.timeout",
          session_id: sessionId,
          timeout_ms: deps.processExitTimeoutMs ?? DEFAULT_PROCESS_EXIT_TIMEOUT_MS,
        },
        "Harness session timed out without new events; stopping it",
      ),
  })
    .then(async (exit) => {
      const entry = deps.sessionService.store.get(sessionId);
      if (entry) {
        const patches = entry.eventStore.getHistory();
        const messages = await persistSessionMessages(sessionId, patches, deps).catch((err) => {
          sessionLogger.error(
            {
              err,
              event: "session.messages.persist.error",
              session_id: sessionId,
            },
            "Failed to persist session messages on session exit",
          );
          return null;
        });

        // The dispatch-started guard entry keeps the attachment file undeletable until
        // its prompt is durably persisted. On exit we release it once the persisted
        // messages reference the attachment, or when persistence failed entirely —
        // a failed persist leaves no message to hand protection off to, so keeping the
        // orphaned entry would block deletion of the attachment forever.
        if (submitted?.submittedQueuePosition !== undefined && deps.sessionQueueEntriesService) {
          const persistedReference =
            messages !== null && messagesReferenceSubmittedAttachments(messages, submitted.submittedAttachmentFileIds);

          if (messages === null || persistedReference) {
            await deps.sessionQueueEntriesService.remove(submitted.submittedQueuePosition);
          }
        }
      } else {
        sessionLogger.warn(
          {
            event: "session.store.missing_on_exit",
            session_id: sessionId,
          },
          "No store entry found on session exit; messages were not persisted",
        );
      }

      const current = await deps.sessionService.get(sessionId);
      if (current?.status === "cancelled") {
        deps.sessionService.store.remove(sessionId);
        return;
      }

      if (exit.status === "failed") {
        sessionLogger.error(
          {
            event: "session.process.exit.failed",
            session_id: sessionId,
          },
          "Harness session exited with failure",
        );
      }
      deps.sessionService.store.remove(sessionId);
      await deps.sessionService.transitionStatus(sessionId, exit.status);
    })
    .catch((err) => {
      sessionLogger.error(
        {
          err,
          event: "session.process.exit_tracking.error",
          session_id: sessionId,
        },
        "Session exit tracking failed",
      );
    });
};
