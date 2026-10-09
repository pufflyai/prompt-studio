import type { HarnessContext, HarnessProvider, ProcessRunInput } from "pstdio-api-contracts/extension-kernel";

// Detection is a short availability probe, not a model request or a session.
const DETECTION_TIMEOUT_MS = 3_000;

export const detectHarness = async (provider: HarnessProvider, context: HarnessContext) => {
  if (!provider.detect) return { available: true };
  const deadline = Date.now() + DETECTION_TIMEOUT_MS;
  let finished = false;
  const bounded = (input: ProcessRunInput) => {
    const remaining = deadline - Date.now();
    if (finished || remaining <= 0) throw new Error("Harness detection deadline reached.");
    return { ...input, timeoutMs: Math.min(input.timeoutMs ?? remaining, remaining) };
  };
  const ctx: HarnessContext = {
    ...context,
    process: {
      ...context.process,
      run: (input) => context.process.run(bounded(input)),
      runOrThrow: (input) => context.process.runOrThrow(bounded(input)),
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
    return { available: false };
  } finally {
    finished = true;
    clearTimeout(timer);
  }
};
