import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { resumeAgentSession, spawnAgentSession } from "./spawn-agent";

type ExistingSession = NonNullable<Awaited<ReturnType<SessionsRouteDeps["sessionService"]["get"]>>>;
type PendingQueueEntry = Awaited<ReturnType<SessionsRouteDeps["sessionQueueEntriesService"]["listPending"]>>[number];

type CreateAndStartInput = {
  projectId: string;
  title: string;
  agentId: string;
  prompt: string;
  model?: string;
  originalSessionId?: string;
  cwd?: string;
  onBeforeStartedHook?: (session: ExistingSession) => Promise<void>;
};

type StartExistingInput = {
  session: ExistingSession;
  prompt: string;
  cwd: string;
  agentId?: string;
  model?: string;
  respectCapacity?: boolean;
  questionResponse?: { answers: string[][] };
};

let schedulingLock = Promise.resolve();

const withSchedulingLock = async <T>(operation: () => Promise<T>) => {
  const previous = schedulingLock;
  const { promise, resolve } = Promise.withResolvers<void>();
  schedulingLock = previous.then(() => promise);

  await previous;
  try {
    return await operation();
  } finally {
    resolve();
  }
};

const logStartupFailure = async (
  deps: SessionsRouteDeps,
  input: { error: unknown; session: ExistingSession; agentId: string; cwd?: string; model?: string },
) => {
  sessionLogger.error(
    {
      err: input.error,
      event: "session.spawn.failed",
      session_id: input.session.id,
      project_id: input.session.project_id,
      agent: input.agentId,
      cwd: input.cwd ?? null,
      model: input.model ?? null,
    },
    "Agent session startup failed",
  );
  await deps.sessionService.transitionStatus(input.session.id, "failed");
};

const hasCreateCapacity = async (deps: SessionsRouteDeps) => {
  const settings = await deps.settingsService.get();
  const limit = settings.max_concurrent_sessions;

  if (limit == null) return true;

  const activeCount = await deps.sessionService.countActive();
  return activeCount < limit;
};

const updateExistingDispatchSelection = async (
  deps: SessionsRouteDeps,
  input: { session: ExistingSession; agentId: string; model?: string; switchingAgent: boolean },
) => {
  if (input.switchingAgent) {
    await deps.sessionService.update(input.session.id, {
      agent: input.agentId,
      agent_session_id: null,
      last_selected_model: input.model ?? null,
    });
    return;
  }

  if (input.model && input.model !== input.session.last_selected_model) {
    await deps.sessionService.update(input.session.id, { last_selected_model: input.model });
  }
};

const queueExistingFollowUp = async (
  deps: SessionsRouteDeps,
  input: StartExistingInput & { agentId: string; switchingAgent: boolean },
) => {
  await updateExistingDispatchSelection(deps, input);
  await deps.sessionService.queueExistingWithEntry({
    id: input.session.id,
    prompt: input.prompt,
    request_kind: "follow_up",
    question_response_json: input.questionResponse ?? null,
  });
};

const runBeforeStartedHook = async (
  deps: SessionsRouteDeps,
  session: ExistingSession,
  hook: CreateAndStartInput["onBeforeStartedHook"],
  cleanup: { drainAfterLock: boolean },
) => {
  try {
    await hook?.(session);
  } catch (error) {
    if (session.status === "queued") {
      await deps.sessionService.cancel(session.id);
    } else {
      await deps.sessionService.transitionStatus(session.id, "failed", { drainCapacity: false });
      cleanup.drainAfterLock = true;
    }
    throw error;
  }
};

const dispatchQueuedEntry = async (deps: SessionsRouteDeps, session: ExistingSession, entry: PendingQueueEntry) => {
  const agentId = session.agent!;
  const model = session.last_selected_model ?? undefined;
  const cwd = session.cwd ?? undefined;
  const dispatchSession = await deps.sessionService.claimQueuedForDispatch(session.id);

  if (!dispatchSession) return;

  if (entry.request_kind === "start") {
    spawnAgentSession(
      { sessionId: session.id, agentId, prompt: entry.prompt, title: session.title, model, cwd },
      deps,
    ).catch((error) => logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }));
    await deps.sessionQueueEntriesService.remove(session.id);
    deps.sessionService.emitStartedHook?.(dispatchSession);
    return;
  }

  if (session.agent_session_id) {
    resumeAgentSession(
      {
        sessionId: session.id,
        agentSessionId: session.agent_session_id,
        agentId,
        prompt: entry.prompt,
        model,
        cwd: cwd ?? "",
        questionResponse: entry.question_response_json as { answers: string[][] } | undefined,
      },
      deps,
    ).catch((error) => logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }));
    await deps.sessionQueueEntriesService.remove(session.id);
    deps.sessionService.emitResumedHook?.(dispatchSession);
    return;
  }

  spawnAgentSession({ sessionId: session.id, agentId, prompt: entry.prompt, model, cwd }, deps).catch((error) =>
    logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }),
  );
  await deps.sessionQueueEntriesService.remove(session.id);
  deps.sessionService.emitResumedHook?.(dispatchSession);
};

export const createSessionScheduler = (deps: SessionsRouteDeps) => {
  const drainQueue = async () => {
    return withSchedulingLock(async () => {
      while (await hasCreateCapacity(deps)) {
        const [entry] = await deps.sessionQueueEntriesService.listPending();
        if (!entry) return;

        const session = await deps.sessionService.get(entry.session_id);
        if (!session || session.status !== "queued") {
          await deps.sessionQueueEntriesService.markDispatchStarted(entry.session_id);
          continue;
        }

        await dispatchQueuedEntry(deps, session, entry);
      }
    });
  };

  const createAndStartSession = async (input: CreateAndStartInput) => {
    const cleanup = { drainAfterLock: false };
    let scheduled!: { session: ExistingSession; shouldStart: boolean };

    try {
      scheduled = await withSchedulingLock(async () => {
        const hasCapacity = await hasCreateCapacity(deps);

        if (!hasCapacity) {
          const queued = await deps.sessionService.createQueuedWithEntry(
            {
              project_id: input.projectId,
              title: input.title,
              agent: input.agentId,
              last_selected_model: input.model,
              original_session_id: input.originalSessionId,
              cwd: input.cwd,
              prompt: input.prompt,
              request_kind: "start",
            },
            { emitStartedHook: false },
          );
          await runBeforeStartedHook(deps, queued, input.onBeforeStartedHook, cleanup);

          return { session: queued, shouldStart: false };
        }

        const started = await deps.sessionService.create(
          {
            project_id: input.projectId,
            title: input.title,
            agent: input.agentId,
            last_selected_model: input.model,
            original_session_id: input.originalSessionId,
            cwd: input.cwd,
          },
          { emitStartedHook: false },
        );
        await runBeforeStartedHook(deps, started, input.onBeforeStartedHook, cleanup);

        return { session: started, shouldStart: true };
      });
    } catch (error) {
      if (cleanup.drainAfterLock) {
        await drainQueue();
      }
      throw error;
    }

    const { session, shouldStart } = scheduled;

    if (!shouldStart) {
      return session;
    }

    spawnAgentSession(
      {
        sessionId: session.id,
        agentId: input.agentId,
        prompt: input.prompt,
        title: input.title,
        model: input.model,
        cwd: input.cwd,
      },
      deps,
    ).catch((error) =>
      logStartupFailure(deps, { error, session, agentId: input.agentId, cwd: input.cwd, model: input.model }),
    );
    deps.sessionService.emitStartedHook?.(session);

    return session;
  };

  const startOrQueueExisting = async (input: StartExistingInput) => {
    return withSchedulingLock(async () => {
      const { session, prompt, cwd } = input;
      const agentId = input.agentId ?? session.agent!;
      const switchingAgent = input.agentId != null && input.agentId !== session.agent;
      const model = input.model ?? (switchingAgent ? undefined : (session.last_selected_model ?? undefined));

      if (input.respectCapacity && !input.questionResponse && !(await hasCreateCapacity(deps))) {
        await queueExistingFollowUp(deps, { ...input, agentId, switchingAgent });
        return;
      }

      if (switchingAgent) {
        await updateExistingDispatchSelection(deps, { session, agentId, model: input.model, switchingAgent });
        const resumed = await deps.sessionService.resume(session.id, { emitResumedHook: false });
        const dispatchSession = resumed ?? session;
        spawnAgentSession({ sessionId: session.id, agentId, prompt, model, cwd }, deps).catch((error) =>
          logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }),
        );
        deps.sessionService.emitResumedHook?.(dispatchSession);
        return;
      }

      await updateExistingDispatchSelection(deps, { session, agentId, model: input.model, switchingAgent });

      const resumed = await deps.sessionService.resume(session.id, { emitResumedHook: false });
      const dispatchSession = resumed ?? session;

      if (session.agent_session_id) {
        resumeAgentSession(
          {
            sessionId: session.id,
            agentSessionId: session.agent_session_id,
            agentId,
            prompt,
            model,
            cwd,
            questionResponse: input.questionResponse,
          },
          deps,
        ).catch((error) => logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }));
        deps.sessionService.emitResumedHook?.(dispatchSession);
        return;
      }

      spawnAgentSession({ sessionId: session.id, agentId, prompt, model, cwd }, deps).catch((error) =>
        logStartupFailure(deps, { error, session: dispatchSession, agentId, cwd, model }),
      );
      deps.sessionService.emitResumedHook?.(dispatchSession);
    });
  };

  const resumeForApproval = async (sessionId: string) => {
    return deps.sessionService.resume(sessionId);
  };

  const recoverQueuedSessions = async () => {
    const claimedEntries = await deps.sessionQueueEntriesService.listDispatchStarted();
    for (const entry of claimedEntries) {
      const session = await deps.sessionService.get(entry.session_id);
      if (session?.status === "in_progress" && !deps.sessionService.store.get(session.id)) {
        await deps.sessionService.recoverQueuedDispatchClaim(session.id);
      }
    }

    await drainQueue();
  };

  return { createAndStartSession, startOrQueueExisting, resumeForApproval, drainQueue, recoverQueuedSessions };
};
