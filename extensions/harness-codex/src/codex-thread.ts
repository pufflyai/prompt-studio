import type { createAppServerTransport } from "./app-server-transport";
import type { Turn } from "./protocol/v2/Turn";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";
import { codexThreadConfig } from "./thread-config";

const resumedTurns = (turns: Turn[] | undefined, snapshot: { thread: { turns: Turn[] } } | undefined) =>
  turns ?? snapshot?.thread.turns ?? [];
export const createCodexThread = (
  rpc: ReturnType<typeof createAppServerTransport>,
  identity: string,
  owner: Parameters<typeof rpc.retain>[0],
) => {
  const ready = rpc.ready;
  let threadId: string | undefined;
  let transcriptPath: string | null = null;
  let model: string | undefined;
  let unresolved = false;
  let currentTurn: string | undefined;
  let turnRevision = 0;
  let goalRevision = 0;
  let awaitingTurn: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  const settleTurn = () => {
    awaitingTurn?.resolve();
    awaitingTurn = undefined;
  };
  let loading: Promise<string> | undefined;
  const resolveUncertainTurn = async () => {
    const state = (await rpc.request("thread/read", { threadId, includeTurns: true })) as { thread: { turns: Turn[] } };
    requireTerminalState(state.thread.turns);
  };
  const requireTerminalState = (turns: Turn[]) => {
    unresolved = turns.some((turn) => turn.status === "inProgress");
    if (unresolved)
      throw new Error("Native Codex execution is still in progress. Wait for its terminal state before retrying.");
  };
  const loadThread = async (run: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    await ready;
    if (rpc.isClosed()) throw new Error("Codex worker disconnected.");
    if (threadId) {
      if (unresolved) await resolveUncertainTurn();
      return threadId;
    }
    if (run.agentSessionId) rpc.claim(run.agentSessionId, identity, owner);
    const config = await codexThreadConfig(rpc, run);
    const snapshot = run.agentSessionId
      ? ((await rpc.request(
          "thread/read",
          { threadId: run.agentSessionId, includeTurns: true },
          undefined,
          run.signal,
        )) as {
          thread: { turns: Turn[] };
        })
      : undefined;
    const result = (await rpc.request(
      run.agentSessionId ? "thread/resume" : "thread/start",
      {
        ...(run.agentSessionId ? { threadId: run.agentSessionId } : {}),
        ...(run.model ? { model: run.model } : {}),
        ...(run.params?.service_tier ? { serviceTier: run.params.service_tier } : {}),
        cwd: run.cwd,
        approvalPolicy: "never",
        sandbox: "danger-full-access",
        config,
      },
      (value) => {
        const id = (value as { thread: { id: string } }).thread.id;
        rpc.claim(id, identity, owner);
        threadId = id;
      },
    )) as { thread: { id: string; path: string | null; turns?: Turn[] }; model?: string };
    threadId = result.thread.id;
    transcriptPath = result.thread.path;
    model = result.model ?? run.model ?? undefined;
    requireTerminalState(resumedTurns(result.thread.turns, snapshot));
    return threadId;
  };
  const load = async (run: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    const work = loading ?? loadThread(run);
    loading = work;
    try {
      const id = await work;
      if (run.agentSessionId && id !== run.agentSessionId)
        throw new Error("Codex worker belongs to a different thread.");
      return id;
    } finally {
      if (loading === work) loading = undefined;
    }
  };
  return {
    load,
    isIdle: () => !loading && !unresolved && !currentTurn && !awaitingTurn,
    id: () => threadId,
    model: () => model,
    transcriptPath: () => transcriptPath,
    markUncertain: () => {
      unresolved = true;
    },
    setModel: (next: string | undefined) => {
      model = next;
    },
    nativeTurn: async () => {
      await awaitingTurn?.promise;
      return currentTurn;
    },
    prepareTurn: () => {
      awaitingTurn = Promise.withResolvers<void>();
    },
    rejectTurn: settleTurn,
    disconnect: settleTurn,
    turnRevision: () => turnRevision,
    goalRevision: () => goalRevision,
    acknowledge: (id: string | undefined, revision: number) => {
      if (!id || revision !== turnRevision) return;
      // turn/start can steer an observed goal turn without another start notification.
      if (currentTurn === id) settleTurn();
      currentTurn = id;
    },
    receive: (message: import("./app-server-rpc").RpcMessage) => {
      if (message.method === "thread/goal/updated") goalRevision++;
      const turn = message.params?.turn as { id: string } | undefined;
      if (!turn) return;
      if (message.method === "turn/started") {
        currentTurn = turn.id;
        turnRevision++;
        settleTurn();
      }
      if (message.method === "turn/completed") {
        if (turn.id === currentTurn) currentTurn = undefined;
        turnRevision++;
        settleTurn();
      }
    },
    settled: () => loading?.catch(() => {}),
  };
};
