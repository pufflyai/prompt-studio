import type { Handler } from "./handles";
import { acquireOwnerStreamReader, createOwnerReadableStream } from "./stream-source";

const retainReadableStream = (source: ReadableStream<unknown>, release: () => void) => {
  const reader = acquireOwnerStreamReader(source);
  const value = createOwnerReadableStream({
    bytes: reader.bytes,
    read: reader.read,
    cancel: reader.cancel,
    release: () => {
      reader.release();
      release();
    },
  });
  return { value, retained: true };
};

export const discardOwnerResult = async (result: unknown) => {
  if (result instanceof ReadableStream) await result.cancel();
  else if (result && typeof result === "object" && Symbol.asyncIterator in result) {
    const iterator = (result as AsyncIterable<unknown>)[Symbol.asyncIterator]();
    await iterator.return?.();
  }
};

// These results outlive the factory call that exported their context. Release
// that context only when their existing stream/session contract finishes.
export const retainOwnerResult = (result: unknown, release: () => void) => {
  if (result instanceof ReadableStream) return retainReadableStream(result, release);
  if (result && typeof result === "object" && Symbol.asyncIterator in result) {
    const stream = result as AsyncIterable<unknown>;
    const iterator = stream[Symbol.asyncIterator].bind(stream);
    stream[Symbol.asyncIterator] = async function* () {
      try {
        yield* { [Symbol.asyncIterator]: iterator };
      } finally {
        release();
      }
    };
    return { value: result, retained: true };
  }
  const session = result as { done?: Promise<unknown>; invoke?: Handler } | undefined;
  if (session?.done instanceof Promise) {
    void session.done.then(release, release);
    return { value: result, retained: true };
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
    return { value: result, retained: true };
  }
  return { value: result, retained: false };
};
