import type { HarnessSession } from "@pstdio/sdk/extensions";
import { createAppServerOperation, type NativeOperation } from "./app-server-operation";
import { createAppServerRpc } from "./app-server-rpc";
import type { SpawnDeps } from "./codex-process";
import { nativeThreadMessages } from "./native-history";
import type { Turn } from "./protocol/v2/Turn";
import { questionReplyError } from "./questions";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";
import { codexTurnRequest } from "./turn-request";

const reasoningConfig = (params: StartSpawnInput["params"]) => ({
  model_reasoning_effort: params?.model_reasoning_effort ?? "medium",
});
const resumedTurns = (turns: Turn[] | undefined, snapshot: { thread: { turns: Turn[] } } | undefined) =>
  turns ?? snapshot?.thread.turns ?? [];
export const createCodexWorker = (input: StartSpawnInput, deps: SpawnDeps) => {
  const child = deps.spawnProcess(
    ["app-server", "--listen", "stdio://", "--enable", "default_mode_request_user_input"],
    { cwd: input.cwd, env: input.env },
  );
  let closed = false;
  let threadId: string | undefined;
  let transcriptPath: string | null = null;
  let model: string | undefined;
  let unresolved = false;
  let active: ReturnType<typeof createAppServerOperation> | undefined;
  const rpc = createAppServerRpc(child, (message) => {
    if (message.params?.threadId && message.params.threadId !== threadId) return;
    active?.receive(message);
  });
  const lost = () => {
    closed = true;
    active?.finish({ status: "disconnected" });
    child.kill();
  };
  child.onExit.then(lost);
  rpc.finished.then(lost, lost);
  const ready = rpc
    .request("initialize", { clientInfo: { name: "pstdio", version: "1" }, capabilities: { experimentalApi: true } })
    .then(() => rpc.write({ method: "initialized" }));
  ready.catch(lost);
  const resolveUncertainTurn = async () => {
    const state = (await rpc.request("thread/read", { threadId, includeTurns: true })) as { thread: { turns: Turn[] } };
    requireTerminalState(state.thread.turns);
  };
  const requireTerminalState = (turns: Turn[]) => {
    unresolved = turns.some((turn) => turn.status === "inProgress");
    if (unresolved)
      throw new Error("Native Codex execution is still in progress. Wait for its terminal state before retrying.");
  };
  const load = async (run: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    await ready;
    if (closed) throw new Error("Codex worker disconnected.");
    if (threadId) {
      if (unresolved) await resolveUncertainTurn();
      if (run.agentSessionId && threadId !== run.agentSessionId)
        throw new Error("Codex worker belongs to a different thread.");
      return threadId;
    }
    const snapshot = run.agentSessionId
      ? ((await rpc.request("thread/read", { threadId: run.agentSessionId, includeTurns: true })) as {
          thread: { turns: Turn[] };
        })
      : undefined;
    const result = (await rpc.request(run.agentSessionId ? "thread/resume" : "thread/start", {
      ...(run.agentSessionId ? { threadId: run.agentSessionId } : {}),
      ...(run.model ? { model: run.model } : {}),
      cwd: run.cwd,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
      config: reasoningConfig(run.params),
    })) as { thread: { id: string; path: string | null; turns?: Turn[] }; model?: string };
    threadId = result.thread.id;
    transcriptPath = result.thread.path;
    model = run.model ?? result.model;
    requireTerminalState(resumedTurns(result.thread.turns, snapshot));
    return threadId;
  };
  const run = async (runInput: StartSpawnInput & Partial<ResumeSpawnInput>, command?: NativeOperation) => {
    if (runInput.questionResponse) throw questionReplyError("Codex question request is no longer pending.");
    if (active) throw new Error("Codex already has an active operation.");
    let acknowledged = false;
    const abort = () => {
      if (!acknowledged || !threadId) {
        child.kill();
        return;
      }
      void operation.stop(rpc.request, threadId).catch(lost);
    };
    const operation = createAppServerOperation(runInput, {
      command,
      transcriptPath: () => transcriptPath,
      write: rpc.write,
      onFinish: () => {
        if (active === operation) active = undefined;
        runInput.signal?.removeEventListener("abort", abort);
      },
    });
    const session = (id: string) =>
      ({
        agentSessionId: id,
        done: operation.done,
        stop: () => operation.stop(rpc.request, id),
        replyQuestion: operation.replyQuestion,
        timeoutStrategy: "provider",
        pid: child.pid,
      }) satisfies HarnessSession;
    active = operation;
    runInput.signal?.addEventListener("abort", abort, { once: true });
    try {
      runInput.signal?.throwIfAborted();
      const id = await load(runInput);
      if (!command) {
        const state = (await rpc.request("thread/goal/get", { threadId: id })) as { goal?: { status: string } | null };
        operation.setGoal(state.goal?.status === "active");
      }
      operation.startDelivery();
      const result = (await rpc.request(
        command?.method ?? "turn/start",
        command ? { ...command.params, threadId: id } : codexTurnRequest(runInput, id, model),
      )) as { turn?: { id: string } };
      acknowledged = true;
      operation.acknowledge(result.turn?.id);
      return session(id);
    } catch (error) {
      // Delivery may have reached Codex. Never resubmit this input.
      operation.fail(error);
      operation.finish({ status: closed ? "disconnected" : "failed" });
      if (threadId) return session(threadId);
      throw error;
    }
  };
  return {
    run,
    load,
    isClosed: () => closed,
    threadId: () => threadId,
    request: async (method: string, params: Record<string, unknown>) => {
      await ready;
      return rpc.request(method, params);
    },
    readMessages: async (id: string) => {
      await ready;
      const result = (await rpc.request("thread/read", { threadId: id, includeTurns: true })) as {
        thread: { turns: Turn[] };
      };
      return nativeThreadMessages(result.thread.turns);
    },
    dispose: async () => {
      closed = true;
      active?.finish({ status: "cancelled" });
      child.kill();
      await Promise.all([child.onExit, rpc.finished.catch(() => {})]);
    },
  };
};
