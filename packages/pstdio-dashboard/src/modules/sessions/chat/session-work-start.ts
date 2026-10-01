import type { PendingFollowUpState } from "./session-chat-state";

export const resolveSessionWorkStartedAt = (
  lastRequestStarted: string | null | undefined,
  pending?: Pick<PendingFollowUpState, "submittedAt" | "previousRunStarted">,
  runInProgress = false,
) => {
  const runStart = lastRequestStarted ? Date.parse(lastRequestStarted) : undefined;
  if (runInProgress) return runStart;
  if (pending && !hasPendingSessionRunStarted(lastRequestStarted ?? null, pending.previousRunStarted))
    return pending.submittedAt;
  return runStart;
};

// A changed server identity acknowledges the run even when the browser clock is ahead.
export const hasPendingSessionRunStarted = (lastRequestStarted: string | null, previousRunStarted: string | null) =>
  lastRequestStarted !== null && lastRequestStarted !== previousRunStarted;
