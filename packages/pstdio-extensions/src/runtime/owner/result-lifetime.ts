import type { Handler } from "./handles";

// These results outlive the factory call that exported their context. Release
// that context only when their existing stream/session contract finishes.
export const retainOwnerResult = (result: unknown, release: () => void) => {
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
    return true;
  }
  const session = result as { done?: Promise<unknown>; invoke?: Handler } | undefined;
  if (session?.done instanceof Promise) {
    void session.done.then(release, release);
    return true;
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
    return true;
  }
  return false;
};
