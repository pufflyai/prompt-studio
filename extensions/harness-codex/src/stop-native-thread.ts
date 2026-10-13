import { CodexRequestRejectedError } from "./app-server-rpc";
import type { createAppServerTransport } from "./app-server-transport";
import type { Turn } from "./protocol/v2/Turn";
export const stopNativeThread = async (
  rpc: ReturnType<typeof createAppServerTransport>,
  threadId: string,
  currentTurn: () => Promise<string | undefined>,
) => {
  const state = (await rpc.request("thread/goal/get", { threadId })) as { goal?: { status: string } | null };
  if (state.goal?.status === "active") await rpc.request("thread/goal/set", { threadId, status: "paused" });
  const turnId = await currentTurn();
  if (!turnId) return;
  try {
    await rpc.request("turn/interrupt", { threadId, turnId });
  } catch (error) {
    if (!(error instanceof CodexRequestRejectedError)) throw error;
    // Completion may win the race with interruption. Prove it from native state.
    const snapshot = (await rpc.request("thread/read", { threadId, includeTurns: true })) as {
      thread: { turns: Turn[] };
    };
    if (snapshot.thread.turns.some((turn) => turn.status === "inProgress")) throw error;
  }
};
