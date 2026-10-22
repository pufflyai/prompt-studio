import type { HarnessContext, HarnessProvider } from "pstdio-api-contracts/extension-kernel";
import { HarnessDisposedError } from "./harness-disposed-error";
import type { HarnessCallOptions } from "./harness-registry";
import type { HarnessSessionResources } from "./harness-session-resources";

export const createRetainedHarnessCalls = (
  provider: HarnessProvider,
  context: (options?: HarnessCallOptions) => Promise<HarnessContext>,
  resources: HarnessSessionResources,
) => {
  const owner = {};
  let retired = false;
  const ensureActive = () => {
    if (retired) throw new HarnessDisposedError("Harness has been disposed.");
  };
  return {
    invoke: async <T>(
      input: { sessionId?: string },
      options: HarnessCallOptions | undefined,
      action: () => Promise<T>,
      until?: (result: T) => Promise<unknown>,
    ) => {
      ensureActive();
      if (!input.sessionId || !provider.releaseSession) return action();
      const sessionId = input.sessionId;
      const ctx = await context(options);
      ensureActive();
      const finished = await resources.acquire(owner, sessionId, async () =>
        provider.releaseSession!(ctx, { sessionId }),
      );
      try {
        ensureActive();
        const result = await action();
        if (until) void until(result).then(finished, finished);
        else finished();
        return result;
      } catch (error) {
        finished();
        throw error;
      }
    },
    retire: () => {
      retired = true;
      return resources.retire(owner);
    },
  };
};
