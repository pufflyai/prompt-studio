import { randomUUID } from "node:crypto";
import { setupLogger } from "./logger";

interface SetupContext {
  project_id?: string;
  workspace_id?: string;
  extension?: string;
  task?: string;
}

export const traceSetupPhase = async <T>(phase: string, context: SetupContext, run: () => Promise<T>) => {
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const fields = {
    ...context,
    event: "runtime.setup.phase",
    phase,
    span_id: randomUUID(),
    diagnostic_pid: process.pid,
  };
  setupLogger.info({ ...fields, state: "started" }, "Runtime setup step started");
  let state = "failed";
  try {
    const result = await run();
    state = "completed";
    return result;
  } finally {
    const cpu = process.cpuUsage(startedCpu);
    setupLogger.info(
      {
        ...fields,
        state,
        duration_ms: Math.round(performance.now() - startedAt),
        diagnostic_cpu_user_ms: cpu.user / 1000,
        diagnostic_cpu_system_ms: cpu.system / 1000,
        diagnostic_rss_bytes: process.memoryUsage.rss(),
      },
      "Runtime setup step finished",
    );
  }
};
