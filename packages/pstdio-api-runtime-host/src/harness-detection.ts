import type { HarnessContext, HarnessProvider, ProcessRunInput } from "pstdio-api-contracts/extension-kernel";

// Detection is a short availability probe, not a model request or a session.
const DETECTION_TIMEOUT_MS = 3_000;

export const detectHarness = async (provider: HarnessProvider, context: HarnessContext) => {
  if (!provider.detect) return { available: true };
  const deadline = Date.now() + DETECTION_TIMEOUT_MS;
  let finished = false;
  const pending = new Set<Promise<unknown>>();
  const bounded = (input: ProcessRunInput) => {
    const remaining = deadline - Date.now();
    if (finished || remaining <= 0) throw new Error("Harness detection deadline reached.");
    return { ...input, timeoutMs: Math.min(input.timeoutMs ?? remaining, remaining) };
  };
  const run = (method: "run" | "runOrThrow", input: ProcessRunInput) => {
    const operation = context.process[method](bounded(input));
    pending.add(operation);
    operation.then(
      () => pending.delete(operation),
      () => pending.delete(operation),
    );
    return operation;
  };
  const ctx: HarnessContext = {
    ...context,
    process: {
      ...context.process,
      run: (input) => run("run", input),
      runOrThrow: (input) => run("runOrThrow", input),
    },
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.detect!(ctx)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Harness detection deadline reached.")), DETECTION_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Do not log raw provider output: it can include credentials or other host data.
    context.logger.warn(`Harness ${provider.id} detection failed or exceeded ${DETECTION_TIMEOUT_MS} ms.`);
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
