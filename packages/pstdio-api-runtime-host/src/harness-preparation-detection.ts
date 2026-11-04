import type { HarnessContext, HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import { DETECTION_TIMEOUT_MS, detectHarness } from "./harness-detection";
import { HarnessDisposedError } from "./harness-disposed-error";

// The availability wait is bounded; its deadline never cancels a background download.
export const detectPreparedHarness = async (
  provider: HarnessProvider,
  prepare: () => Promise<HarnessContext>,
  ensureActive: () => void,
) => {
  const deadline = Date.now() + DETECTION_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const context = await Promise.race([
      prepare(),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), DETECTION_TIMEOUT_MS);
      }),
    ]);
    ensureActive();
    if (!context) return { available: false, reason: "Harness preparation is in progress. Try again shortly." };
    return await detectHarness(provider, context, deadline);
  } catch (error) {
    if (error instanceof HarnessDisposedError) throw error;
    return { available: false, reason: "Harness preparation failed. Run pst logs for details." };
  } finally {
    clearTimeout(timer);
  }
};
