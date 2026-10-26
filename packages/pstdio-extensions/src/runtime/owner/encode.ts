import type { createHandleStore, Handler, HandleScope } from "./handles";
import { readLocalValue } from "./local-values";
import { type OwnerMessage, protocolLimits, type WireValue } from "./protocol";
export const createOwnerEncoder = (
  store: ReturnType<typeof createHandleStore>,
  send: (message: OwnerMessage) => void,
) => {
  const signal = (value: AbortSignal, scope?: HandleScope): WireValue => {
    const id = crypto.randomUUID();
    const abort = () => {
      try {
        send({ type: "abort", id });
      } catch {}
    };
    value.addEventListener("abort", abort, { once: true });
    (scope?.cleanup ?? store.cleanup).add(() => value.removeEventListener("abort", abort));
    return { type: "signal", id, aborted: value.aborted };
  };
  const promise = (value: Promise<unknown>, scope?: HandleScope): WireValue => {
    const settled = value.then(
      (result) => ({ result }),
      (error) => ({ error }),
    );
    const id = store.register(
      async () => {
        const next = await settled;
        if ("error" in next) throw next.error;
        return next.result;
      },
      undefined,
      scope,
    );
    return { type: "promise", id };
  };
  const iterable = (value: AsyncIterable<unknown>, scope?: HandleScope): WireValue => {
    const iterator = value[Symbol.asyncIterator]();
    const dispose = () => {
      void Promise.resolve(iterator.return?.()).catch(() => {});
    };
    const id = store.register(
      (operation) => (operation === "return" ? iterator.return?.() : iterator.next()),
      undefined,
      scope,
      dispose,
    );
    return { type: "iterator", id };
  };
  const object = (value: object, scope: HandleScope | undefined, ancestors: Set<unknown>): WireValue => {
    if (ancestors.has(value)) throw new Error("Cyclic extension payloads are not supported.");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
      throw new Error("Unsupported extension payload prototype.");
    ancestors.add(value);
    try {
      if (Array.isArray(value)) return { type: "array", values: value.map((item) => encode(item, scope, ancestors)) };
      return {
        type: "object",
        values: Object.entries(value).map(([key, item]) => [key, encode(item, scope, ancestors)]),
      };
    } finally {
      ancestors.delete(value);
    }
  };
  const primitive = (value: unknown, scope?: HandleScope): WireValue | undefined => {
    if (value === undefined) return { type: "undefined" };
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "function")
      return { type: "function", id: store.register(value as Handler, undefined, scope) };
    return undefined;
  };
  const binary = (value: Uint8Array | ArrayBuffer): WireValue => {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
    if (bytes.byteLength > protocolLimits.bytes / 4)
      throw new Error("Extension binary payload exceeds its size limit.");
    return { type: "bytes", values: [...bytes] };
  };
  const encode = (value: unknown, scope?: HandleScope, ancestors = new Set<unknown>()): WireValue => {
    if (ancestors.size > 64) throw new Error("Extension payload nesting exceeds its depth limit.");
    const local = readLocalValue(value);
    if (local) return { type: "local", value: encode(local, scope, ancestors) };
    const literal = primitive(value, scope);
    if (literal !== undefined) return literal;
    if (typeof value !== "object" || value === null) throw new Error(`Unsupported extension payload: ${typeof value}`);
    if (value instanceof AbortSignal) return signal(value, scope);
    if (value instanceof Promise) return promise(value, scope);
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) return binary(value);
    if (Symbol.asyncIterator in value) return iterable(value as AsyncIterable<unknown>, scope);
    return object(value, scope, ancestors);
  };
  return encode;
};
