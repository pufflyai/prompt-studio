import { expect, test } from "bun:test";
import type { ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { createProcessHandleProxy } from "./process-owner";

test("end() closes input after writes made before it, even ones nobody awaited", async () => {
  const received: string[] = [];
  let ended = false;
  const opening = Promise.withResolvers<ProcessHandle>();
  const proxy = createProcessHandleProxy(opening.promise);
  const pending = proxy.write("hello");
  const closing = proxy.end();
  // The child opens later, and its own write checks input only when it runs.
  opening.resolve({
    id: "child",
    started: Promise.resolve(),
    exited: new Promise(() => {}),
    write: async (data: string | Uint8Array) => {
      await Bun.sleep(5);
      if (ended) throw new Error("The process input is closed.");
      received.push(String(data));
    },
    end: async () => {
      ended = true;
    },
    kill: async () => {},
    events: () => ({ [Symbol.asyncIterator]: async function* () {} }),
  } as unknown as ProcessHandle);
  await closing;
  await pending;
  expect(received).toEqual(["hello"]);
  expect(ended).toBe(true);
});
