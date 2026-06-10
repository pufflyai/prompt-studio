import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";

type ResolveHarnessExitInput = {
  session: Pick<HarnessSession, "done" | "stop" | "timeoutStrategy">;
  /** Event stream used as the liveness signal for the activity watchdog. */
  activity: AsyncIterable<unknown>;
  timeoutMs: number;
  /** Invoked when the watchdog fires, before the session is stopped. */
  onTimeout?: () => void;
};

const TIMEOUT_EXIT: HarnessExit = { status: "failed" };

// Resolves a session's final exit. Providers with timeoutStrategy "provider"
// self-terminate, so `done` is trusted as-is; otherwise an activity watchdog
// stops the session when no events arrive for `timeoutMs`.
export const resolveHarnessExit = (input: ResolveHarnessExitInput): Promise<HarnessExit> => {
  const { session, activity, timeoutMs, onTimeout } = input;

  if (session.timeoutStrategy === "provider") return session.done;

  return new Promise<HarnessExit>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const activityIterator = activity[Symbol.asyncIterator]();

    const settle = (exit: HarnessExit) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      void activityIterator.return?.();
      resolve(exit);
    };

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onTimeout?.();
        Promise.resolve()
          .then(() => session.stop())
          .catch(() => {});
        settle(TIMEOUT_EXIT);
      }, timeoutMs);
    };

    resetTimer();

    void (async () => {
      try {
        while (!settled) {
          const { done } = await activityIterator.next();
          if (done || settled) break;
          resetTimer();
        }
      } catch {
        // Watcher failure stops liveness resets; `done` or the timer settles the exit.
      }
    })();

    session.done.then(settle);
  });
};
