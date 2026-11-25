import { randomUUID } from "node:crypto";
import type { HarnessContext, HarnessProvider, ProcessRunInput } from "pstdio-api-contracts/extension-kernel";
import { mapHostContext, prepareBackendHandler } from "pstdio-extensions";
import { traceDetectionPhase } from "./harness-detection-phase";

// Detection is a short availability probe, not a model request or a session.
const DETECTION_TIMEOUT_MS = 3_000;
// Starting the harness's extension worker, which a cold machine can take several seconds for.
const WORKER_START_TIMEOUT_MS = 30_000;

/** Starts the harness's worker outside the probe's deadline. False when it fails or takes too long. */
const startHarnessWorker = async (provider: HarnessProvider) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      prepareBackendHandler(provider.detect).then(
        () => true,
        () => false,
      ),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), WORKER_START_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const detectHarness = async (provider: HarnessProvider, context: HarnessContext) => {
  if (!provider.detect) return { available: true };
  // A worker that did not start is not probed: probing would only start it again.
  if (!(await startHarnessWorker(provider))) {
    context.logger.warn(`Harness ${provider.id} extension backend did not start.`, {
      harness_id: provider.id,
      event: "harness.detection.failed",
      failure: "worker_start",
    });
    return { available: false, reason: "The extension backend did not start. Run pst logs for details." };
  }
  const started = performance.now();
  const identity = { harness_id: provider.id, detection_id: randomUUID() };
  const deadline = Date.now() + DETECTION_TIMEOUT_MS;
  const deadlineError = new Error("Harness detection deadline reached.");
  let finished = false;
  const pending = new Set<Promise<unknown>>();
  const bounded = (input: ProcessRunInput) => {
    const remaining = deadline - Date.now();
    if (finished || remaining <= 0) throw deadlineError;
    return { ...input, timeoutMs: Math.min(input.timeoutMs ?? remaining, remaining) };
  };
  const run = (process: HarnessContext["process"], method: "run" | "runOrThrow", input: ProcessRunInput) => {
    const operation = traceDetectionPhase(context, identity, `process.${method}`, () =>
      process[method](bounded(input)),
    );
    pending.add(operation);
    operation.then(
      () => pending.delete(operation),
      () => pending.delete(operation),
    );
    return operation;
  };
  const ctx = mapHostContext(context, (base) => ({
    ...base,
    process: {
      ...base.process,
      run: (input) => run(base.process, "run", input),
      runOrThrow: (input) => run(base.process, "runOrThrow", input),
    },
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      traceDetectionPhase(context, identity, "provider", () => Promise.resolve().then(() => provider.detect!(ctx))),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(deadlineError), DETECTION_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    // Do not log raw provider output: it can include credentials or other host data.
    context.logger.warn(`Harness ${provider.id} detection failed or exceeded ${DETECTION_TIMEOUT_MS} ms.`, {
      ...identity,
      event: "harness.detection.failed",
      failure: error === deadlineError ? "deadline" : "provider_error",
      duration_ms: performance.now() - started,
    });
    return {
      available: false,
      reason: `The availability check failed or took longer than ${DETECTION_TIMEOUT_MS / 1000} seconds. Run pst logs for details.`,
    };
  } finally {
    finished = true;
    clearTimeout(timer);
    // The availability deadline can win before its command has finished tree cleanup.
    await Promise.allSettled([...pending]);
  }
};
