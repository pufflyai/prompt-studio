import { AsyncLocalStorage } from "node:async_hooks";
import { readCommandRejection } from "../runner/command-rejection";
import { createPendingCalls } from "./pending-calls";
import {
  BACKEND_PROTOCOL_VERSION,
  type BackendHandlerRef,
  BackendUnavailableError,
  deserializeBackendError,
  HANDLER_MARKER,
  type HostToWorkerMessage,
  serializeBackendError,
  transferableCommandRejection,
  type WorkerToHostMessage,
} from "./protocol";
import { createFunctionTable, createImportTracker, discardValue, importValue } from "./remote-values";
import { createSurfaceFacade, type SurfaceStep } from "./surface";

type Handler = (...args: unknown[]) => unknown;

/**
 * Replaces every function in the definition with a handler reference. Callback code stays in this
 * process; the host receives only data it can normalize and the ids it may invoke.
 */
export const describeBackendDefinition = (definition: unknown) => {
  const handlers = new Map<string, Handler>();
  const seen = new WeakMap<object, unknown>();
  const members = (value: object) => {
    const names = new Set(Object.keys(value));
    // Class instances keep their methods on the prototype chain.
    for (
      let proto = Object.getPrototypeOf(value);
      proto && proto !== Object.prototype;
      proto = Object.getPrototypeOf(proto)
    )
      for (const name of Object.getOwnPropertyNames(proto))
        if (name !== "constructor" && typeof (value as Record<string, unknown>)[name] === "function") names.add(name);
    return names;
  };
  const unsupported = (path: string) =>
    new TypeError(`Extension definition value at ${path} cannot be sent to the host. Use plain objects and arrays.`);
  const describeObject = (value: object, path: string) => {
    const copy: Record<string, unknown> = {};
    seen.set(value, copy);
    for (const name of members(value)) {
      const member = (value as Record<string, unknown>)[name];
      const entry = typeof member === "function" ? member.bind(value) : member;
      // defineProperty keeps an own "__proto__" key a key instead of changing the copy's prototype.
      Object.defineProperty(copy, name, {
        value: describe(entry, `${path}.${name}`),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return copy;
  };
  const describeArray = (value: unknown[], path: string) => {
    const copy: unknown[] = [];
    seen.set(value, copy);
    for (const [index, entry] of value.entries()) copy.push(describe(entry, `${path}[${index}]`));
    return copy;
  };
  const describe = (value: unknown, path: string): unknown => {
    if (typeof value === "function") {
      const id = `h${handlers.size}`;
      handlers.set(id, value as Handler);
      return { [HANDLER_MARKER]: id } satisfies BackendHandlerRef;
    }
    if (typeof value === "symbol" || typeof value === "bigint") throw unsupported(path);
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Uint8Array || value instanceof Date || value instanceof RegExp) return value;
    if (value instanceof Map || value instanceof Set || value instanceof Promise) throw unsupported(path);
    if (seen.has(value)) return seen.get(value);
    return Array.isArray(value) ? describeArray(value, path) : describeObject(value, path);
  };
  return { definition: describe(definition, "default"), handlers };
};

const send = (message: WorkerToHostMessage) => process.send?.(message);

/**
 * Runs in the private worker process: no API, no host database connection and no host environment
 * secrets. It still runs as the user's OS account, so it is not a filesystem sandbox (ADR 0058).
 */
export const runBackendWorker = () => {
  let handlers = new Map<string, Handler>();
  type Invocation = {
    controller: AbortController;
    table: ReturnType<typeof createFunctionTable>;
    tracker: ReturnType<typeof createImportTracker>;
    settled: boolean;
    awaiting: number;
  };
  const invocations = new Map<string, Invocation>();
  const pending = createPendingCalls();
  const callback = new AsyncLocalStorage<{ invocationId: string; requestId: string } | undefined>();
  let nextRequest = 0;

  const discard = (id: string) => {
    const entry = invocations.get(id);
    if (!entry) return;
    invocations.delete(id);
    pending.reject(id, new BackendUnavailableError("The invocation has finished."));
    entry.table.clear();
  };

  const dispose = (id: string) => {
    const entry = invocations.get(id);
    if (entry?.settled && !entry.awaiting && !entry.table.size && !entry.tracker.live) discard(id);
  };

  const importFrom = (id: string, value: unknown) =>
    importValue(
      value,
      (fn, args, keepAbortListener) => callHost(id, fn, args, keepAbortListener),
      invocations.get(id)?.tracker,
    );

  const within = (invocationId: string) => {
    const active = callback.getStore();
    return active?.invocationId === invocationId ? { within: active.requestId } : {};
  };

  /** Sends a request to the host and resolves with its reply, importing any host functions in it. */
  // Recursive with callHost, so TypeScript needs the return types spelled out.
  const request = async (invocationId: string, message: (requestId: string) => WorkerToHostMessage) => {
    const entry = invocations.get(invocationId);
    if (!entry) throw new BackendUnavailableError("The invocation has finished.");
    const requestId = `r${nextRequest++}`;
    const reply = pending.start(invocationId, requestId, undefined);
    entry.awaiting += 1;
    try {
      send(message(requestId));
      return importFrom(invocationId, await reply.promise);
    } finally {
      pending.take(invocationId, requestId);
      entry.awaiting -= 1;
      dispose(invocationId);
    }
  };

  const callHost = async (
    invocationId: string,
    fnId: string,
    args: unknown[],
    keepAbortListener?: boolean,
  ): Promise<unknown> => {
    const table = invocations.get(invocationId)?.table;
    if (!table) throw new Error("This invocation has finished.");
    const { value, kept } = await table.exportResult(args, keepAbortListener);
    try {
      return await request(invocationId, (requestId) => ({
        v: BACKEND_PROTOCOL_VERSION,
        type: "fn-call",
        invocationId,
        requestId,
        fnId,
        args: value as unknown[],
        ...within(invocationId),
      }));
    } catch (error) {
      if (keepAbortListener) {
        table.release(kept);
        dispose(invocationId);
      }
      throw error;
    }
  };

  const answerHost = async (message: Extract<HostToWorkerMessage, { type: "fn-call" }>) => {
    const { invocationId, requestId } = message;
    const running = invocations.get(invocationId);
    try {
      if (!running || running.controller.signal.aborted) throw new Error("This invocation has finished.");
      const { table } = running;
      const result = await callback.run(message.invocationOwned ? undefined : { invocationId, requestId }, () =>
        table.call(message.fnId, () => importFrom(invocationId, message.args) as unknown[]),
      );
      const revoked = () => invocations.get(invocationId) !== running || running.controller.signal.aborted;
      if (revoked()) {
        discardValue(result);
        return;
      }
      const { value, kept } = await table.exportResult(result).catch((error) => {
        if (revoked()) discardValue(result);
        throw error;
      });
      if (revoked()) {
        table.release(kept);
        return;
      }
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "reply",
        invocationId,
        requestId,
        ok: true,
        value,
      });
    } catch (error) {
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "reply",
        invocationId,
        requestId,
        ok: false,
        error: serializeBackendError(error),
      });
    }
  };

  const invoke = async (message: Extract<HostToWorkerMessage, { type: "invoke" }>) => {
    const { invocationId } = message;
    const controller = new AbortController();
    const table = createFunctionTable();
    const tracker = createImportTracker((fnIds) => {
      if (!invocations.has(invocationId)) return;
      send({ v: BACKEND_PROTOCOL_VERSION, type: "release", invocationId, fnIds });
      dispose(invocationId);
    });
    const entry: Invocation = { controller, table, tracker, settled: false, awaiting: 0 };
    invocations.set(invocationId, entry);
    const channel = {
      signal: controller.signal,
      call: async (path: SurfaceStep[], args: unknown[]) => {
        if (!invocations.has(invocationId)) throw new Error("This invocation has finished.");
        const exported = (await table.exportValue(args)) as unknown[];
        return request(invocationId, (requestId) => ({
          v: BACKEND_PROTOCOL_VERSION,
          type: "call",
          invocationId,
          requestId,
          path,
          args: exported,
          ...within(invocationId),
        }));
      },
      notify: (path: SurfaceStep[], args: unknown[]) =>
        send({ v: BACKEND_PROTOCOL_VERSION, type: "notify", invocationId, path, args, ...within(invocationId) }),
    };
    try {
      const handler = handlers.get(message.handlerId);
      if (!handler) throw new Error(`Unknown backend handler: ${message.handlerId}`);
      const context = createSurfaceFacade(message.surface, message.values, channel);
      const args = importFrom(invocationId, message.args) as unknown[];
      const result = await handler(context, ...args);
      if (invocations.get(invocationId) !== entry) {
        discardValue(result);
        return;
      }
      const { value, kept } = await table.exportResult(result).catch((error) => {
        if (invocations.get(invocationId) !== entry) discardValue(result);
        throw error;
      });
      table.seal(kept);
      send({ v: BACKEND_PROTOCOL_VERSION, type: "result", invocationId, ok: true, value });
    } catch (error) {
      if (invocations.get(invocationId) !== entry) return;
      table.seal();
      const rejection = transferableCommandRejection(readCommandRejection(error, controller.signal));
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "result",
        invocationId,
        ok: false,
        error: serializeBackendError(error),
        rejection,
      });
    } finally {
      entry.settled = true;
      dispose(invocationId);
    }
  };

  const load = async (entryPath: string) => {
    try {
      const module = (await import(entryPath)) as { default?: unknown };
      if (typeof module.default !== "object" || module.default === null)
        throw new Error("Extension entry must export a default contributions object");
      const described = describeBackendDefinition(module.default);
      handlers = described.handlers;
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "loaded",
        ok: true,
        value: described.definition,
        rss: process.memoryUsage.rss(),
      });
    } catch (error) {
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "loaded",
        ok: false,
        error: serializeBackendError(error),
        rss: process.memoryUsage.rss(),
      });
    }
  };

  const settle = (message: Extract<HostToWorkerMessage, { type: "reply" }>) => {
    const reply = pending.take(message.invocationId, message.requestId);
    if (message.ok) reply?.resolve(message.value);
    else reply?.reject(deserializeBackendError(message.error));
  };

  process.on("message", (raw: HostToWorkerMessage) => {
    if (raw?.v !== BACKEND_PROTOCOL_VERSION) return;
    if (raw.type === "load") void load(raw.entryPath);
    else if (raw.type === "invoke") void invoke(raw);
    else if (raw.type === "cancel") {
      const reason = deserializeBackendError(raw.reason);
      pending.reject(raw.invocationId, reason);
      invocations.get(raw.invocationId)?.controller.abort(reason);
    } else if (raw.type === "discard") discard(raw.invocationId);
    else if (raw.type === "reply") settle(raw);
    else if (raw.type === "fn-call") void answerHost(raw);
    else if (raw.type === "ping")
      send({ v: BACKEND_PROTOCOL_VERSION, type: "pong", seq: raw.seq, rss: process.memoryUsage.rss() });
    else if (raw.type === "release") {
      invocations.get(raw.invocationId)?.table.release(raw.fnIds);
      dispose(raw.invocationId);
    }
  });
  // The host disconnects on retirement; nothing in this process outlives it.
  process.on("disconnect", () => process.exit(0));
  send({ v: BACKEND_PROTOCOL_VERSION, type: "ready" });
};
