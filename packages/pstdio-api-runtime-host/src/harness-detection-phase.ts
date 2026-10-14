import { randomUUID } from "node:crypto";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";

export const traceDetectionPhase = async <T>(
  context: HarnessContext,
  identity: { harness_id: string; detection_id: string },
  phase: "provider" | "process.run" | "process.runOrThrow",
  run: () => T | Promise<T>,
) => {
  const started = performance.now();
  const metadata = { ...identity, event: "harness.detection.phase", phase, span_id: randomUUID() };
  context.logger.info("Harness detection step started", { ...metadata, state: "started" });
  let state = "failed";
  try {
    const result = await run();
    state = "completed";
    return result;
  } finally {
    // Provider output, commands and environment values can contain private host data.
    context.logger.info("Harness detection step finished", {
      ...metadata,
      state,
      duration_ms: performance.now() - started,
    });
  }
};
