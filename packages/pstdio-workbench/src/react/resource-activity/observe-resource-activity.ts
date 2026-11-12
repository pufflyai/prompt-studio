import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { ResourceActivityBinding } from "../../core/registries/resources/resource-activity";

const waitForReconnect = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, 1000);
    signal.addEventListener("abort", done, { once: true });
    if (signal.aborted) done();
  });
/** Re-admit a logical observation after transport failure without opening another physical stream. */
export const observeResourceActivity = async (
  binding: ResourceActivityBinding,
  resource: ResourceRef,
  signal: AbortSignal,
  refresh: () => void,
  failed: (error: unknown) => void,
) => {
  while (!signal.aborted) {
    try {
      await binding.watch(resource, { signal, onReady: refresh, onChange: refresh });
    } catch (error) {
      if (!signal.aborted) failed(error);
    }
    if (!signal.aborted) await waitForReconnect(signal);
  }
};
