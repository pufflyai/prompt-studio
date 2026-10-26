import { createOwnerDecoder } from "./decode";
import { createOwnerEncoder } from "./encode";
import { createHandleStore, type Handler } from "./handles";
import { errorFromRemote, type OwnerMessage, protocolLimits, remoteError } from "./protocol";

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  release: () => void;
}
const retainForResult = (result: unknown, release: () => void) => {
  const session = result as { done?: Promise<unknown>; invoke?: Handler } | undefined;
  if (session?.done instanceof Promise) {
    void session.done.then(release, release);
    return;
  }
  if (session && typeof session.invoke === "function") {
    const invoke = session.invoke;
    session.invoke = async (...args) => {
      try {
        return await invoke(...args);
      } finally {
        release();
      }
    };
    return;
  }
  release();
};

export const createOwnerEndpoint = (sendMessage: (message: OwnerMessage) => void) => {
  const store = createHandleStore();
  const pending = new Map<string, PendingCall>();
  const signals = new Map<string, AbortController>();
  const incoming = new Set<string>();
  let closed: Error | undefined;
  const send = (message: OwnerMessage) => {
    if (closed) throw closed;
    if (Buffer.byteLength(JSON.stringify(message)) > protocolLimits.bytes)
      throw new Error("Extension bridge message exceeds its size limit.");
    sendMessage(message);
  };
  const encode = createOwnerEncoder(store, send);
  const decode = createOwnerDecoder((handle, args) => call(handle, args), signals);
  const call = (handle: string, args: unknown[]) => {
    if (closed) return Promise.reject(closed);
    if (pending.size >= protocolLimits.pending)
      return Promise.reject(new Error("Extension bridge pending-call limit reached."));
    const id = crypto.randomUUID();
    const owned = store.createScope();
    const release = () => store.release(owned);
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject, release });
      try {
        send({ type: "call", id, handle, args: encode(args, owned) });
      } catch (error) {
        pending.delete(id);
        release();
        reject(error);
      }
    });
  };
  const settle = (message: Extract<OwnerMessage, { type: "result" | "error" }>) => {
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (!request) return;
    if (message.type === "error") {
      request.release();
      request.reject(errorFromRemote(message.error));
      return;
    }
    try {
      const result = decode(message.value);
      retainForResult(result, request.release);
      request.resolve(result);
    } catch (error) {
      request.release();
      request.reject(error);
    }
  };
  const invoke = async (message: Extract<OwnerMessage, { type: "call" }>) => {
    if (incoming.size >= protocolLimits.pending || incoming.has(message.id)) {
      send({
        type: "error",
        id: message.id,
        error: { name: "Error", message: "Extension bridge incoming-call limit reached." },
      });
      return;
    }
    incoming.add(message.id);
    const disposers = new Set<() => void>();
    let retained = false;
    try {
      const handle = store.functions.get(message.handle);
      if (!handle) throw new Error("Extension bridge handle is unavailable or has been released.");
      const args = decode(message.args, disposers);
      if (!Array.isArray(args)) throw new Error("Extension bridge call arguments must be an array.");
      const result = await handle.fn(...args);
      const done = (result as { done?: unknown } | undefined)?.done;
      if (done instanceof Promise) {
        retained = true;
        const dispose = () => {
          for (const run of disposers) run();
          store.cleanup.delete(dispose);
        };
        store.cleanup.add(dispose);
        void done.then(dispose, dispose);
      }
      send({ type: "result", id: message.id, value: encode(result, handle.scope) });
    } catch (error) {
      if (!closed) send({ type: "error", id: message.id, error: remoteError(error) });
    } finally {
      incoming.delete(message.id);
      if (!retained) for (const dispose of disposers) dispose();
    }
  };
  const receive = async (message: OwnerMessage) => {
    if (closed) return;
    if (!message || typeof message !== "object" || typeof message.type !== "string")
      throw new Error("Invalid extension bridge message.");
    if (Buffer.byteLength(JSON.stringify(message)) > protocolLimits.bytes)
      throw new Error("Extension bridge message exceeds its size limit.");
    switch (message.type) {
      case "abort":
        signals.get(message.id)?.abort();
        return;
      case "release":
        for (const id of message.ids) store.functions.delete(id);
        return;
      case "error":
      case "result":
        settle(message);
        return;
      case "call":
        if (typeof message.id !== "string" || typeof message.handle !== "string")
          throw new Error("Invalid extension bridge call.");
        await invoke(message);
        return;
      default:
        throw new Error("Invalid extension bridge message type.");
    }
  };
  return {
    call,
    receive,
    register: store.register,
    stats: () => ({ handles: store.functions.size, pending: pending.size, signals: signals.size }),
    close: (error: Error) => {
      if (closed) return;
      closed = error;
      for (const request of pending.values()) {
        request.release();
        request.reject(error);
      }
      pending.clear();
      store.close();
      for (const signal of signals.values()) signal.abort();
      signals.clear();
      incoming.clear();
    },
  };
};
