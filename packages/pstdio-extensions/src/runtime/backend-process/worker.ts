import { AsyncLocalStorage } from "node:async_hooks";
import { createPendingCalls } from "./pending-calls";
import {
  BACKEND_PROTOCOL_VERSION,
  type BackendHandlerRef,
  deserializeBackendError,
  HANDLER_MARKER,
  type HostToWorkerMessage,
  serializeBackendError,
  type WorkerToHostMessage,
} from "./protocol";
import { createFunctionTable, discardValue, importValue } from "./remote-values";
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
  const invocations = new Map<string, { controller: AbortController; table: ReturnType<typeof createFunctionTable> }>();
  const pending = createPendingCalls();
  const callback = new AsyncLocalStorage<{ invocationId: string; requestId: string }>();
  let nextRequest = 0;

  const within = (invocationId: string) => {
    const active = callback.getStore();
    return active?.invocationId === invocationId ? { within: active.requestId } : {};
  };

  /** Sends a request to the host and resolves with its reply, importing any host functions in it. */
  // Recursive with callHost, so TypeScript needs the return types spelled out.
  const request = async (invocationId: string, message: (requestId: string) => WorkerToHostMessage) => {
    if (!invocations.has(invocationId)) throw new Error("This invocation has finished.");
    const requestId = `r${nextRequest++}`;
    const reply = pending.start(invocationId, requestId, undefined);
    try {
      send(message(requestId));
    } catch (error) {
      pending.take(invocationId, requestId);
      throw error;
    }
    return importValue(await reply.promise, (fnId, args) => callHost(invocationId, fnId, args));
  };

  const callHost = async (invocationId: string, fnId: string, args: unknown[]): Promise<unknown> => {
    const table = invocations.get(invocationId)?.table;
    if (!table) throw new Error("This invocation has finished.");
    const exported = (await table.exportValue(args)) as unknown[];
    return request(invocationId, (requestId) => ({
      v: BACKEND_PROTOCOL_VERSION,
      type: "fn-call",
      invocationId,
      requestId,
      fnId,
      args: exported,
      ...within(invocationId),
    }));
  };

  const answerHost = async (message: Extract<HostToWorkerMessage, { type: "fn-call" }>) => {
    const { invocationId, requestId } = message;
    const running = invocations.get(invocationId);
    try {
      if (!running || running.controller.signal.aborted) throw new Error("This invocation has finished.");
      const { table } = running;
      const result = await callback.run({ invocationId, requestId }, () =>
        table.call(
          message.fnId,
          () => importValue(message.args, (fnId, inner) => callHost(invocationId, fnId, inner)) as unknown[],
        ),
      );
      if (invocations.get(invocationId) !== running || running.controller.signal.aborted) {
        discardValue(result);
        return;
      }
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "reply",
        invocationId,
        requestId,
        ok: true,
        value: await table.exportValue(result),
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
    invocations.set(invocationId, { controller, table });
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
      const value = await handler(context, ...message.args);
      send({ v: BACKEND_PROTOCOL_VERSION, type: "result", invocationId, ok: true, value });
    } catch (error) {
      send({
        v: BACKEND_PROTOCOL_VERSION,
        type: "result",
        invocationId,
        ok: false,
        error: serializeBackendError(error),
      });
    } finally {
      invocations.delete(invocationId);
      pending.reject(invocationId, new Error("This invocation has finished."));
      table.clear();
    }
  };

  const load = async (entryPath: string) => {
    try {
      const module = (await import(entryPath)) as { default?: unknown };
      if (typeof module.default !== "object" || module.default === null)
        throw new Error("Extension entry must export a default contributions object");
      const described = describeBackendDefinition(module.default);
      handlers = described.handlers;
      send({ v: BACKEND_PROTOCOL_VERSION, type: "loaded", ok: true, value: described.definition });
    } catch (error) {
      send({ v: BACKEND_PROTOCOL_VERSION, type: "loaded", ok: false, error: serializeBackendError(error) });
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
    } else if (raw.type === "reply") settle(raw);
    else if (raw.type === "fn-call") void answerHost(raw);
  });
  // The host disconnects on retirement; nothing in this process outlives it.
  process.on("disconnect", () => process.exit(0));
  send({ v: BACKEND_PROTOCOL_VERSION, type: "ready" });
};
