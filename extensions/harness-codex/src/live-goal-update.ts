import type { createAppServerOperation } from "./app-server-operation";
import { CodexRequestRejectedError } from "./app-server-rpc";
import type { createAppServerTransport } from "./app-server-transport";
import type { ThreadGoal } from "./protocol/v2/ThreadGoal";
import { stopNativeThread } from "./stop-native-thread";
export const liveGoalUpdate = (
  owner: ReturnType<typeof createAppServerOperation>,
  id: string,
  rpc: ReturnType<typeof createAppServerTransport>,
  isCurrent: () => boolean,
  track: (work: Promise<void>) => Promise<void>,
  lost: () => void,
  nativeTurn: () => Promise<string | undefined>,
) => {
  const cancelConfirmedGoal = (signal?: AbortSignal) => {
    if (!signal?.aborted) return;
    owner.finish({ status: "cancelled" });
    signal.throwIfAborted();
  };
  return async (params: Record<string, unknown>, signal?: AbortSignal, prompt?: string) => {
    signal?.throwIfAborted();
    if (!isCurrent()) throw new Error("Current work finished. Send the goal again.");
    const update = owner.beginGoalUpdate();
    const changed = Promise.withResolvers<void>();
    track(changed.promise);
    try {
      await rpc.request("thread/goal/set", { ...params, threadId: id }, (result) => {
        update.confirm((result as { goal: ThreadGoal }).goal.status);
      });
      if (signal?.aborted || !isCurrent()) {
        await stopNativeThread(rpc, id, nativeTurn);
        cancelConfirmedGoal(signal);
        throw new Error("Current work ended while the goal was changing. Reconnect before submitting again.");
      }
      if (prompt) owner.recordGoalUpdate(prompt);
    } catch (error) {
      // A missing acknowledgement may hide a native mutation. Retire the owner without replaying it.
      if (!(error instanceof CodexRequestRejectedError)) lost();
      throw error;
    } finally {
      update.release();
      changed.resolve();
    }
  };
};
