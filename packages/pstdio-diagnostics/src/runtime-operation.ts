import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { channel } from "node:diagnostics_channel";

/**
 * Process-local attribution for host work. Instrumentation publishes measurements, never user content.
 * The database admission also reads extensionId to schedule work fairly, so it must name the extension whose code started the work.
 */
export const runtimeOperationChannel = "pstdio.diagnostics.operation";
const operations = channel(runtimeOperationChannel);
const origins = new AsyncLocalStorage<{ origin?: RuntimeOperationOrigin; parentId?: string }>();

export interface RuntimeOperationOrigin {
  kind: "command" | "event" | "background" | "request";
  id?: string;
  name: string;
  projectId?: string;
  extensionId?: string;
}

type Measurements = Record<string, string | number | boolean | undefined>;

export const withRuntimeOperationOrigin = <T>(origin: RuntimeOperationOrigin, work: () => T) =>
  origins.run({ ...origins.getStore(), origin: { ...origin, id: origin.id ?? randomUUID() } }, work);

export const currentRuntimeOperationOrigin = () => origins.getStore()?.origin;

export const startRuntimeOperation = (kind: string, measurements: Measurements = {}) => {
  if (!operations.hasSubscribers) return;
  return {
    kind,
    id: randomUUID(),
    parentId: origins.getStore()?.parentId,
    startedAt: new Date().toISOString(),
    started: performance.now(),
    origin: origins.getStore()?.origin,
    caller: new Error().stack?.split("\n").slice(2, 12).join("\n").slice(0, 2048),
    measurements,
  };
};

export const finishRuntimeOperation = (
  operation: ReturnType<typeof startRuntimeOperation>,
  measurements: Measurements = {},
) => {
  if (!operation || !operations.hasSubscribers) return;
  const { started, measurements: initial, ...identity } = operation;
  operations.publish({ ...identity, ...initial, ...measurements, durationMs: performance.now() - started });
};

export const runRuntimeOperation = <T>(operation: ReturnType<typeof startRuntimeOperation>, work: () => T) =>
  operation ? origins.run({ ...origins.getStore(), parentId: operation.id }, work) : work();
