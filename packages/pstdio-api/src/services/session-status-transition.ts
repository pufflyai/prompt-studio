import type { SessionExitCause } from "pstdio-api-contracts/extension-kernel";
import type { ActiveSession, createSessionStore } from "../features/sessions/session-store";
import type { SessionServiceDeps, SessionStatus } from "./session-service";
export type TransitionStatusOptions = {
  drainCapacity?: boolean;
  exitCause?: SessionExitCause;
  expectedOwner?: ActiveSession | null;
  expectedLastRequestStarted?: string | null;
  expectedStatus?: SessionStatus;
};

export const releasesCapacity = (status: SessionStatus) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

export const writeSessionTransition = async (
  deps: SessionServiceDeps,
  store: ReturnType<typeof createSessionStore>,
  id: string,
  status: SessionStatus,
  options: TransitionStatusOptions,
) => {
  const raw = deps.sessionsDb;
  const ownsRun = () => options.expectedOwner === undefined || store.get(id) === options.expectedOwner;
  if (!ownsRun()) return null;
  const current = await raw.get(id);
  if (!ownsRun()) return null;
  if (options.expectedStatus !== undefined && current?.status !== options.expectedStatus) return null;
  if (
    options.expectedLastRequestStarted !== undefined &&
    current?.last_request_started !== options.expectedLastRequestStarted
  )
    return null;
  const expectedRun = current?.last_request_started;
  const guarded =
    options.expectedOwner !== undefined ||
    options.expectedLastRequestStarted !== undefined ||
    options.expectedStatus !== undefined;
  return guarded
    ? await raw.updateStatus(id, status, {
        expectedLastRequestStarted: expectedRun ?? null,
        ...(options.expectedStatus ? { expectedStatus: options.expectedStatus } : {}),
        ...(options.exitCause ? { exitCause: options.exitCause } : {}),
      })
    : await raw.updateStatus(id, status, ...(options.exitCause ? [{ exitCause: options.exitCause }] : []));
};
