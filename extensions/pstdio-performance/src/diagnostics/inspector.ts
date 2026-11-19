import { Session } from "node:inspector";
import { diagnosticRuntime } from "./state";

export const post = <T>(session: Session, method: string, params = {}) =>
  new Promise<T>((resolve, reject) => {
    session.post(method, params, (error, value) => (error ? reject(error) : resolve(value as T)));
  });

export const withProfiler = async <T>(id: string, work: (session: Session) => Promise<T>) => {
  if (diagnosticRuntime.active) throw new Error("A backend diagnostic capture is already running.");
  diagnosticRuntime.active = id;
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
      if (diagnosticRuntime.active === id) diagnosticRuntime.active = undefined;
    }
  }
};
