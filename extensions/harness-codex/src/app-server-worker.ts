import { createAppServerOperation, type NativeOperation } from "./app-server-operation";
import { CodexRequestRejectedError } from "./app-server-rpc";
import type { createAppServerTransport } from "./app-server-transport";
import { createAsyncQuestionReplies } from "./async-question-replies";
import { createCodexThread } from "./codex-thread";
import { releaseIdleThread } from "./idle-thread";
import { liveGoalUpdate } from "./live-goal-update";
import { nativeThreadMessages } from "./native-history";
import { operationSession } from "./operation-session";
import type { Turn } from "./protocol/v2/Turn";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";
import { stopNativeThread } from "./stop-native-thread";
import { codexTurnRequest } from "./turn-request";

const needsNativeTurn = (command?: NativeOperation) => !command || command.method === "thread/compact/start";
const knownNotStarted = (deliveryAttempted: boolean, error: unknown) =>
  !deliveryAttempted || error instanceof CodexRequestRejectedError;
const publishFailure = (operation: ReturnType<typeof createAppServerOperation>, error: unknown) => {
  // A failed session sink must not close the transport used by other threads.
  try {
    operation.fail(error);
  } catch {}
};
const acknowledgedModel = (
  current: string | undefined,
  next: string | undefined,
  command: NativeOperation | undefined,
) => (command ? current : (next ?? current));
const setOperationGoal = async (
  rpc: ReturnType<typeof createAppServerTransport>,
  operation: ReturnType<typeof createAppServerOperation>,
  id: string,
  command?: NativeOperation,
) => {
  if (command) return;
  const state = (await rpc.request("thread/goal/get", { threadId: id })) as { goal?: { status: string } | null };
  operation.setGoal(state.goal?.status === "active");
};
const prepareQuestionRun = (
  input: StartSpawnInput & Partial<ResumeSpawnInput>,
  questions: ReturnType<typeof createAsyncQuestionReplies>,
) => {
  const answer = input.questionResponse ? questions.prepare(input.questionResponse) : undefined;
  return { input: answer ? { ...input, prompt: answer.text } : input, accept: answer?.accept };
};
export const createCodexWorker = (
  input: StartSpawnInput,
  rpc: ReturnType<typeof createAppServerTransport>,
  identity: string,
) => {
  let closed = false;
  const disposal = new AbortController();
  let active: ReturnType<typeof createAppServerOperation> | undefined;
  const pending = new Set<Promise<unknown>>();
  const owner = {
    receive: (message: import("./app-server-rpc").RpcMessage) => {
      thread.receive(message);
      active?.receive(message);
    },
    disconnect: () => {
      closed = true;
      thread.disconnect();
      active?.finish({ status: "disconnected" });
    },
  };
  rpc.retain(owner);
  const thread = createCodexThread(rpc, identity, owner);
  const load = (run: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    if (closed) throw new Error("Codex owner disposed.");
    const signal = run.signal ? AbortSignal.any([run.signal, disposal.signal]) : disposal.signal;
    return thread.load({ ...run, signal });
  };
  const ready = rpc.ready;
  const lost = () => {
    thread.markUncertain();
    active?.finish({ status: "disconnected" });
  };
  const track = <T>(work: Promise<T>) => {
    pending.add(work);
    void work.finally(() => pending.delete(work)).catch(() => {});
    return work;
  };
  const failDelivery = (
    error: unknown,
    attempted: boolean,
    operation: ReturnType<typeof createAppServerOperation>,
    session: (id: string) => ReturnType<typeof operationSession>,
  ) => {
    if (attempted && !(error instanceof CodexRequestRejectedError)) thread.markUncertain();
    publishFailure(operation, error);
    operation.finish({ status: closed ? "disconnected" : "failed" });
    if (knownNotStarted(attempted, error)) throw error;
    const id = thread.id();
    if (id) return session(id);
    throw error;
  };
  const execute = async (runInput: StartSpawnInput & Partial<ResumeSpawnInput>, command?: NativeOperation) => {
    if (active) throw new Error("Codex already has an active operation.");
    await Promise.allSettled([...pending]);
    if (active) throw new Error("Codex already has an active operation.");
    const asyncQuestions = createAsyncQuestionReplies(runInput.events);
    const questionRun = prepareQuestionRun(runInput, asyncQuestions);
    runInput = questionRun.input;
    let acknowledged = false;
    let protocolError = false;
    let protocolCleanup: Promise<void> | undefined;
    const cleanupProtocol = (id: string) => (protocolCleanup ??= track(stopNativeThread(rpc, id, thread.nativeTurn)));
    let deliveryAttempted = false;
    const abort = () => {
      if (!acknowledged || !thread.id()) return;
      void operation.stop(rpc.request, thread.id()!).catch(lost);
    };
    const operation = createAppServerOperation(runInput, {
      command,
      transcriptPath: thread.transcriptPath,
      write: rpc.write,
      beforeStop: thread.nativeTurn,
      onProtocolError: (error) => {
        publishFailure(operation, error);
        thread.markUncertain();
        protocolError = true;
        if (acknowledged && thread.id()) void cleanupProtocol(thread.id()!).catch(lost);
        operation.finish({ status: "failed" });
      },
      // Codex pins its login to the process and rejects a later `codex login`. The refresh failure
      // leaves every thread on this process without credentials, so only a new process can continue.
      onLoginRejected: () => void rpc.dispose(),
      onFinish: () => {
        if (active === operation) active = undefined;
        runInput.signal?.removeEventListener("abort", abort);
      },
    });
    const session = (id: string) => operationSession(id, operation, asyncQuestions, rpc, track, thread.markUncertain);
    active = operation;
    runInput.signal?.addEventListener("abort", abort, { once: true });
    try {
      runInput.signal?.throwIfAborted();
      const id = await load(runInput);
      await setOperationGoal(rpc, operation, id, command);
      runInput.signal?.throwIfAborted();
      if (closed) throw new Error("Codex owner disposed.");
      operation.startDelivery();
      deliveryAttempted = true;
      if (needsNativeTurn(command)) thread.prepareTurn();
      const turnInput = codexTurnRequest(runInput, id, thread.model());
      const revision = thread.turnRevision();
      const result = (await rpc.request(
        command?.method ?? "turn/start",
        command ? { ...command.params, threadId: id } : turnInput,
        (value) => {
          thread.acknowledge((value as { turn?: { id: string } }).turn?.id, revision);
        },
      )) as { turn?: { id: string } };
      thread.setModel(acknowledgedModel(thread.model(), turnInput.model, command));
      acknowledged = true;
      operation.acknowledge(result.turn?.id);
      if (protocolError) await cleanupProtocol(id);
      questionRun.accept?.();
      if (runInput.signal?.aborted) await operation.stop(rpc.request, id);
      return session(id);
    } catch (error) {
      if (error instanceof CodexRequestRejectedError) thread.rejectTurn();
      return failDelivery(error, deliveryAttempted, operation, session);
    }
  };
  const run = (runInput: StartSpawnInput & Partial<ResumeSpawnInput>, command?: NativeOperation) => {
    const execution = execute(runInput, command);
    return track(execution);
  };
  return {
    run,
    load,
    isClosed: () => closed,
    threadId: thread.id,
    model: thread.model,
    prepareGoalUpdate: () => {
      const owner = active;
      const id = thread.id();
      if (!owner?.canUpdateGoal() || !id || closed) return;
      const isCurrent = () => active === owner && owner.canUpdateGoal() && !closed;
      return liveGoalUpdate(owner, id, rpc, isCurrent, track, lost, thread.nativeTurn);
    },
    readModel: async (id: string) => {
      if (thread.id() === id && thread.model()) return thread.model();
      await ready;
      // Resume exposes native configuration; omit overrides so discovery cannot apply next-turn settings.
      await load({ ...input, agentSessionId: id, model: undefined, params: undefined });
      return thread.model();
    },
    request: (method: string, params: Record<string, unknown>, signal?: AbortSignal) => {
      const previous = [...pending];
      return track(
        (async () => {
          signal?.throwIfAborted();
          await ready;
          const readOnly = ["thread/read", "thread/goal/get", "config/read"].includes(method);
          if (!readOnly) await Promise.allSettled(previous);
          if (!readOnly && params.threadId)
            await load({
              ...input,
              signal,
              agentSessionId: String(params.threadId),
              model: undefined,
              params: undefined,
            });
          signal?.throwIfAborted();
          if (closed) throw new Error("Codex owner disposed.");
          const readSignal = signal ? AbortSignal.any([signal, disposal.signal]) : disposal.signal;
          const result = await rpc.request(method, params, undefined, readOnly ? readSignal : undefined);
          if (!readOnly && signal?.aborted && thread.id()) await stopNativeThread(rpc, thread.id()!, thread.nativeTurn);
          signal?.throwIfAborted();
          return result;
        })(),
      );
    },
    readMessages: async (id: string) => {
      await ready;
      const result = (await rpc.request("thread/read", { threadId: id, includeTurns: true })) as {
        thread: { turns: Turn[] };
      };
      return nativeThreadMessages(result.thread.turns);
    },
    releaseIdle: async () => {
      if (closed) return true;
      // The host serializes this release with later startup and controls.
      // Unsubscribe only after checking native work; never stop or pause it here.
      return releaseIdleThread(
        rpc,
        thread,
        () => !active && !pending.size,
        async () => {
          closed = true;
          try {
            await rpc.release(owner);
            disposal.abort();
            return true;
          } catch (error) {
            closed = rpc.isClosed();
            throw error;
          }
        },
      );
    },
    dispose: async () => {
      closed = true;
      disposal.abort();
      active?.finish({ status: "cancelled" });
      await Promise.allSettled([...pending]);
      await thread.settled();
      if (thread.id() && !rpc.isClosed()) {
        try {
          await stopNativeThread(rpc, thread.id()!, thread.nativeTurn);
        } catch (error) {
          if (!rpc.isClosed()) throw error;
        }
      }
      await rpc.release(owner);
    },
    shutdown: () => {
      closed = true;
      disposal.abort();
      active?.finish({ status: "cancelled" });
    },
  };
};
