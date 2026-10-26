import type { createHandleStore, HandleScope } from "./handles";
import { acquireOwnerStreamReader, createOwnerReadableStream, type OwnerStreamReadResult } from "./stream-source";

export const encodeOwnerStream = (
  stream: ReadableStream<unknown>,
  store: ReturnType<typeof createHandleStore>,
  scope?: HandleScope,
) => {
  const reader = acquireOwnerStreamReader(stream);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    reader.release();
  };
  const id = store.register(
    async (operation, reason) => {
      if (operation === "cancel") {
        try {
          await reader.cancel(reason);
          return { done: true, value: undefined };
        } finally {
          finish();
        }
      }
      if (operation !== "read") throw new Error("Invalid extension stream operation.");
      try {
        const next = await reader.read();
        if (next.done) finish();
        return next;
      } catch (error) {
        finish();
        throw error;
      }
    },
    undefined,
    scope,
    () => {
      if (!closed)
        void reader
          .cancel()
          .finally(finish)
          .catch(() => {});
    },
  );
  return { type: "stream" as const, id, bytes: reader.bytes };
};

export const decodeOwnerStream = (
  id: string,
  bytes: boolean,
  call: (handle: string, args: unknown[]) => Promise<unknown>,
  release: (id: string) => void,
) => {
  let released = false;
  const finish = () => {
    if (released) return;
    released = true;
    release(id);
  };
  return createOwnerReadableStream({
    bytes,
    read: async () => (await call(id, ["read"])) as OwnerStreamReadResult,
    cancel: (reason) => call(id, ["cancel", reason]),
    release: finish,
  });
};
