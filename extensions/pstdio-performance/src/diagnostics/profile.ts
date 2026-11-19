import type { Profiler } from "node:inspector";
import { setTimeout as delay } from "node:timers/promises";
import { frequentFunctions } from "./functions";
import { post, withProfiler } from "./inspector";
import { collectOperationTrace } from "./operation-trace";
import type { DiagnosticKind, DiagnosticSummary } from "./types";

export const captureProfile = (input: { id: string; kind: DiagnosticKind; durationMs: number; signal?: AbortSignal }) =>
  withProfiler(input.id, async (session) => {
    input.signal?.throwIfAborted();
    const trace = collectOperationTrace();
    try {
      if (input.kind === "cpu") await post(session, "Profiler.start");
      else await post(session, "Profiler.startPreciseCoverage", { callCount: true, detailed: true });
      const startedAt = new Date().toISOString();
      const start = performance.now();
      const memoryBefore = process.memoryUsage();
      await delay(input.durationMs, undefined, { signal: input.signal });
      input.signal?.throwIfAborted();
      let profile: Profiler.Profile | undefined;
      let coverage: Profiler.ScriptCoverage[] | undefined;
      if (input.kind === "cpu") profile = (await post<Profiler.StopReturnType>(session, "Profiler.stop")).profile;
      else {
        coverage = (await post<Profiler.TakePreciseCoverageReturnType>(session, "Profiler.takePreciseCoverage")).result;
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
          operations: trace.snapshot(),
          profile,
          coverage,
        },
      };
    } finally {
      trace.close();
    }
  });
