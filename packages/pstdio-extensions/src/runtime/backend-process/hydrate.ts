import { isHostContext } from "../runner/host-context";
import { emptySurface, extensionContextSurface } from "./context-surface";
import { HANDLER_MARKER, isBackendHandlerRef } from "./protocol";
import { withSnapshotSinks } from "./remote-markers";
import type { BackendWorker } from "./supervisor";

const PREPARE = Symbol.for("pstdio.backendHandler.prepare");

/**
 * Starts the worker a handler runs in, if it is a worker handler and its worker is not running.
 * Callers with a short deadline, such as harness detection, wait for this before starting the clock.
 */
export const prepareBackendHandler = async (handler: unknown) => {
  const prepare = (handler as { [PREPARE]?: () => Promise<unknown> } | null | undefined)?.[PREPARE];
  if (typeof prepare === "function") await prepare();
};

/**
 * Turns the worker's definition back into one the host can normalize. Each handler reference
 * becomes a host function that runs the handler in the worker. A runner context passed first is
 * reachable only through the process-mode surface; any other argument must be cloneable data.
 */
export const hydrateBackendDefinition = (definition: unknown, acquire: () => Promise<BackendWorker>) => {
  const seen = new WeakMap<object, unknown>();
  const hydrate = (value: unknown): unknown => {
    if (isBackendHandlerRef(value)) {
      const handlerId = value[HANDLER_MARKER];
      const handler = async (first: unknown, ...rest: unknown[]) => {
        const hasContext = isHostContext(first);
        if (hasContext) first.signal?.throwIfAborted();
        const worker = await acquire();
        return hasContext
          ? worker.invoke({
              handlerId,
              context: first,
              surface: extensionContextSurface(first),
              args: rest.map(withSnapshotSinks),
              signal: first.signal,
            })
          : worker.invoke({ handlerId, context: {}, surface: emptySurface, args: [first, ...rest] });
      };
      return Object.assign(handler, { [PREPARE]: acquire });
    }
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Uint8Array || value instanceof Date || value instanceof RegExp) return value;
    if (seen.has(value)) return seen.get(value);
    const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
    seen.set(value, copy);
    for (const [key, entry] of Object.entries(value)) (copy as Record<string, unknown>)[key] = hydrate(entry);
    return copy;
  };
  return hydrate(definition);
};
