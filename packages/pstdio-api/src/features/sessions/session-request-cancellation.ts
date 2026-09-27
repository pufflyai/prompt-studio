import type { HarnessSession } from "pstdio-api-contracts";
import { sessionLogger } from "../../lib/logger";
import type { SessionsRouteDeps } from "./deps";
import { checkpointConversation } from "./session-checkpoint";
import type { ActiveSession } from "./session-store";

type CancellationDeps = Pick<SessionsRouteDeps, "sessionService" | "fileService">;

const finalizeCancellation = async (sessionId: string, entry: ActiveSession | null, deps: CancellationDeps) => {
  if (!entry || deps.sessionService.store.get(sessionId) !== entry) return;
  await checkpointConversation(sessionId, entry, deps);
  deps.sessionService.store.remove(sessionId, entry);
};

export class SessionCancellationCleanupError extends Error {
  constructor(readonly cause: unknown) {
    super(`Session cancellation cleanup failed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export const bindSessionCancellation = async (
  signal: AbortSignal | undefined,
  session: HarnessSession,
  deps: CancellationDeps,
  sessionId: string,
  entry: ActiveSession | null = deps.sessionService.store.get(sessionId),
) => {
  if (!signal) return async () => {};
  let cancelling: Promise<void> | undefined;
  const cancel = () => {
    cancelling ??= Promise.resolve().then(async () => {
      try {
        await session.stop();
      } catch (error) {
        sessionLogger.error(
          { err: error, event: "session.abort_stop.failed", session_id: sessionId },
          "Failed to stop harness session after its request was cancelled",
        );
        if (entry) deps.sessionService.store.setSession(sessionId, session, entry);
        throw new SessionCancellationCleanupError(error);
      }
      if (deps.sessionService.store.get(sessionId) === entry) {
        if (entry) await checkpointConversation(sessionId, entry, deps);
        await deps.sessionService.transitionStatus(sessionId, "cancelled", { expectedOwner: entry });
        if (entry) deps.sessionService.store.remove(sessionId, entry);
      }
    });
    return cancelling;
  };
  const onAbort = () => void cancel().catch(() => undefined);
  signal.addEventListener("abort", onAbort, { once: true });
  void session.done.then(
    () => signal.removeEventListener("abort", onAbort),
    () => signal.removeEventListener("abort", onAbort),
  );
  const throwIfCancelled = async () => {
    if (!signal.aborted) return;
    await cancel();
    signal.throwIfAborted();
  };
  await throwIfCancelled();
  return throwIfCancelled;
};

export const rejectPersistedSessionCancellation = async (
  session: HarnessSession,
  deps: CancellationDeps,
  sessionId: string,
  entry: ActiveSession | null = deps.sessionService.store.get(sessionId),
) => {
  const persisted = await deps.sessionService.get(sessionId);
  if (persisted?.status !== "cancelled") return;

  try {
    await session.stop();
  } catch (error) {
    sessionLogger.error(
      { err: error, event: "session.persisted_cancel_stop.failed", session_id: sessionId },
      "Failed to stop a harness session accepted after persisted cancellation",
    );
    if (entry) deps.sessionService.store.setSession(sessionId, session, entry);
    throw new SessionCancellationCleanupError(error);
  }

  await finalizeCancellation(sessionId, entry, deps);
  throw new DOMException("Session was cancelled.", "AbortError");
};

export const rejectStoreSessionCancellation = async (
  session: HarnessSession,
  deps: CancellationDeps,
  sessionId: string,
  entry: ActiveSession | null = deps.sessionService.store.get(sessionId),
) => {
  try {
    await session.stop();
  } catch (error) {
    sessionLogger.error(
      { err: error, event: "session.install_after_cancel_stop.failed", session_id: sessionId },
      "Failed to stop a harness session installed after cancellation",
    );
    throw new SessionCancellationCleanupError(error);
  }

  await finalizeCancellation(sessionId, entry, deps);
  throw new DOMException("Session was cancelled.", "AbortError");
};
