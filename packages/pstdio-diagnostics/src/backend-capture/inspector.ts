import { Session } from "node:inspector";
import { setTimeout as delay } from "node:timers/promises";

export const diagnosticsError = (code: string, message: string) => Object.assign(new Error(message), { code });

export const post = <T>(session: Session, method: string, params = {}) =>
  new Promise<T>((resolve, reject) => {
    session.post(method, params, (error, value) => (error ? reject(error) : resolve(value as T)));
  });

/** Waits, rejecting with the signal's own reason when it aborts so callers see why the capture stopped. */
export const wait = (ms: number, signal?: AbortSignal) =>
  delay(ms, undefined, { signal }).catch((error: unknown) => {
    signal?.throwIfAborted();
    throw error;
  });

// The process has one V8 profiler; overlapping sessions would stop each other's recordings.
let active = false;

export const withProfiler = async <T>(work: (session: Session) => Promise<T>) => {
  if (active) throw diagnosticsError("diagnostics_busy", "A backend diagnostic capture is already running.");
  active = true;
  const session = new Session();
  let connected = false;
  try {
    session.connect();
    connected = true;
    await post(session, "Profiler.enable");
    return await work(session);
  } finally {
    try {
      if (connected) {
        // Cancellation or a failed checkpoint can leave either recording mode active.
        await post(session, "Profiler.stop").catch(() => {});
        await post(session, "Profiler.stopPreciseCoverage").catch(() => {});
        await post(session, "Profiler.disable").catch(() => {});
        session.disconnect();
      }
    } finally {
      active = false;
    }
  }
};
