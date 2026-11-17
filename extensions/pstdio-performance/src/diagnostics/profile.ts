import { type Profiler, Session } from "node:inspector";
import { setTimeout as delay } from "node:timers/promises";
import { frequentFunctions } from "./functions";
import { diagnosticRuntime } from "./state";
import type { DiagnosticKind, DiagnosticSummary } from "./types";

const post = <T>(session: Session, method: string, params = {}) =>
  new Promise<T>((resolve, reject) => {
    session.post(method, params, (error, value) => (error ? reject(error) : resolve(value as T)));
  });

export const captureProfile = async (input: {
  id: string;
  kind: DiagnosticKind;
  durationMs: number;
  signal?: AbortSignal;
}) => {
  if (diagnosticRuntime.active) throw new Error("A backend diagnostic capture is already running.");
  input.signal?.throwIfAborted();
  diagnosticRuntime.active = input.id;
  const session = new Session();
  let connected = false;
  let recording = false;
  try {
    session.connect();
    connected = true;
    await post(session, "Profiler.enable");
    input.signal?.throwIfAborted();
    if (input.kind === "cpu") await post(session, "Profiler.start");
    else await post(session, "Profiler.startPreciseCoverage", { callCount: true, detailed: true });
    recording = true;
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const memoryBefore = process.memoryUsage();
    await delay(input.durationMs, undefined, { signal: input.signal });
    input.signal?.throwIfAborted();
    let profile: Profiler.Profile | undefined;
    let coverage: Profiler.ScriptCoverage[] | undefined;
    if (input.kind === "cpu") {
      recording = false;
      profile = (await post<Profiler.StopReturnType>(session, "Profiler.stop")).profile;
    } else {
      coverage = (await post<Profiler.TakePreciseCoverageReturnType>(session, "Profiler.takePreciseCoverage")).result;
      recording = false;
      await post(session, "Profiler.stopPreciseCoverage");
    }
    const memoryAfter = process.memoryUsage();
    const durationMs = Math.round(performance.now() - start);
    const summary: DiagnosticSummary = {
      durationMs,
      unit: profile ? "samples" : "calls",
      ...frequentFunctions(profile, coverage),
      memoryBefore,
      memoryAfter,
    };
    return {
      summary,
      data: {
        kind: input.kind,
        pid: process.pid,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs,
        memoryBefore,
        memoryAfter,
        profile,
        coverage,
      },
    };
  } finally {
    try {
      if (connected) {
        try {
          if (recording) await post(session, input.kind === "cpu" ? "Profiler.stop" : "Profiler.stopPreciseCoverage");
        } finally {
          await post(session, "Profiler.disable");
        }
      }
    } finally {
      if (connected) session.disconnect();
      if (diagnosticRuntime.active === input.id) diagnosticRuntime.active = undefined;
    }
  }
};
