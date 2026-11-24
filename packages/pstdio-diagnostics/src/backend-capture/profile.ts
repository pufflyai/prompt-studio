import type {
  BackendCpuProfile,
  BackendDiagnosticSummary,
  BackendProfileCaptureData,
  BackendScriptCoverage,
} from "pstdio-api-contracts/extension-kernel";
import { frequentFunctions } from "./functions";
import { post, wait, withProfiler } from "./inspector";
import { collectOperationTrace } from "./operation-trace";

export const captureProfile = async (input: { kind: "cpu" | "coverage"; durationMs: number; signal?: AbortSignal }) => {
  input.signal?.throwIfAborted();
  return withProfiler(async (session) => {
    input.signal?.throwIfAborted();
    const trace = collectOperationTrace();
    try {
      if (input.kind === "cpu") await post(session, "Profiler.start");
      else await post(session, "Profiler.startPreciseCoverage", { callCount: true, detailed: true });
      const startedAt = new Date().toISOString();
      const start = performance.now();
      const memoryBefore = process.memoryUsage();
      await wait(input.durationMs, input.signal);
      input.signal?.throwIfAborted();
      let profile: BackendCpuProfile | undefined;
      let coverage: BackendScriptCoverage[] | undefined;
      if (input.kind === "cpu")
        profile = (await post<{ profile: BackendCpuProfile }>(session, "Profiler.stop")).profile;
      else {
        coverage = (await post<{ result: BackendScriptCoverage[] }>(session, "Profiler.takePreciseCoverage")).result;
        await post(session, "Profiler.stopPreciseCoverage");
      }
      const memoryAfter = process.memoryUsage();
      const durationMs = Math.round(performance.now() - start);
      const summary: BackendDiagnosticSummary = {
        durationMs,
        unit: profile ? "samples" : "calls",
        ...frequentFunctions(profile, coverage),
        memoryBefore,
        memoryAfter,
      };
      const data: BackendProfileCaptureData = {
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
      };
      return { summary, data };
    } finally {
      trace.close();
    }
  });
};
