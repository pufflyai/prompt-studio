import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { setupLogger } from "./logger";

interface SetupContext {
  project_id?: string;
  workspace_id?: string;
  extension?: string;
}

export const traceSetupPhase = async <T>(phase: string, context: SetupContext, run: () => Promise<T>) => {
  const startedAt = performance.now();
  const fields = { ...context, event: "runtime.setup.phase", phase, span_id: randomUUID() };
  setupLogger.info({ ...fields, state: "started" }, "Runtime setup step started");
  let state = "failed";
  try {
    const result = await run();
    state = "completed";
    return result;
  } finally {
    if (process.env.NATIVE_PROFILE_LOG) appendFileSync(process.env.NATIVE_PROFILE_LOG, `${JSON.stringify({...fields,kind:"setup",ms:Math.round(performance.now()-startedAt)})}\n`);
    setupLogger.info(
      { ...fields, state, duration_ms: Math.round(performance.now() - startedAt) },
      "Runtime setup step finished",
    );
  }
};
