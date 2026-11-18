import type { HarnessExit, HarnessSession } from "@pstdio/sdk/extensions";

export const toHarnessSession = (input: {
  agentSessionId: string;
  abortController: AbortController;
  abortSession: () => Promise<void>;
  done: Promise<HarnessExit>;
}): HarnessSession => {
  const { agentSessionId, abortController, abortSession, done } = input;
  // Aborting the controller stops the poll loop; the server-side abort is best-effort.
  let stopping: Promise<void> | undefined;
  const stop = () =>
    (stopping ??= (async () => {
      abortController.abort();
      await abortSession().catch((error) => {
        console.error(`[opencode] failed to abort session ${agentSessionId}`, error);
      });
    })());

  return {
    agentSessionId,
    // The host does not call stop when a turn ends, so a poll that gives up with an
    // error must stop OpenCode itself, or it keeps changing the worktree.
    done: done.then(
      async (exit) => {
        await stopping;
        return exit;
      },
      async (error: unknown) => {
        await stop();
        throw error;
      },
    ),
    stop,
    timeoutStrategy: "provider",
  };
};
