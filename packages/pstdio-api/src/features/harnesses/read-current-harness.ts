import { HarnessDisposedError, type HarnessHandle } from "pstdio-api-runtime-host";
import type { HarnessRegistryService, HarnessScopeOptions } from "./harness-registry-service";

// Retry only reads rejected by host retirement. Native mutations are never replayed.
export const readCurrentHarness = async <T>(
  registry: HarnessRegistryService,
  id: string,
  options: HarnessScopeOptions,
  read: (harness: HarnessHandle) => Promise<T>,
) => {
  for (let attempt = 0; ; attempt += 1) {
    const harness = await registry.get(id, options);
    if (!harness) return null;
    try {
      return await read(harness);
    } catch (error) {
      if (!(error instanceof HarnessDisposedError) || attempt > 0) throw error;
    }
  }
};
