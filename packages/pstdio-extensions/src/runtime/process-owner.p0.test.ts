import { expect, test } from "bun:test";
import type { ProcessEvent, ProcessExit, ProcessHandle } from "pstdio-api-contracts/extension-kernel";
import { createProcessHandleProxy, createProcessOwner } from "./process-owner";
import { createInvocationScope } from "./runner/scope";

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

test("a write after end() is refused, as on the child's own handle", async () => {
  const written: string[] = [];
  const proxy = createProcessHandleProxy(
    Promise.resolve({
      id: "child",
      started: Promise.resolve(),
      exited: new Promise(() => {}),
      write: async (data: string | Uint8Array) => void written.push(String(data)),
      end: async () => {},
      kill: async () => {},
      events: () => ({ [Symbol.asyncIterator]: async function* () {} }),
    } as unknown as ProcessHandle),
  );
  const first = proxy.write("a");
  const closing = proxy.end();
  let refusal = "";
  try {
    await proxy.write("b");
  } catch (error) {
    refusal = String(error);
  }
  await closing;
  await first;
  expect(refusal).toContain("closed");
  expect(written).toEqual(["a"]);
});

test("a provider that returns before starting keeps queued input inside the startup credit", async () => {
  const ready = Promise.withResolvers<void>();
  const accepted: number[] = [];
  const provider: ProcessHandle = {
    id: "remote",
    started: ready.promise,
    exited: Promise.resolve({ code: 0, signal: null }),
    write: async (data) => void accepted.push(data.length),
    end: async () => {},
    kill: async () => {},
    events: async function* () {},
  };
  const handle = createProcessHandleProxy(Promise.resolve(provider));
  const bytes = new Uint8Array(5 * 1024 * 1024);
  const first = handle.write(bytes);
  await Bun.sleep(0);
  const second = handle.write(bytes).then(
    () => "accepted",
    () => "over credit",
  );
  await Bun.sleep(0);
  const beforeReady = accepted.slice();
  const closed = handle.end();
  ready.resolve();
  await Promise.all([first, closed]);
  expect(beforeReady).toEqual([]);
  expect(await second).toBe("over credit");
  expect(accepted).toEqual([bytes.length]);
});

test("return releases a pending output read without waiting for the process", async () => {
  const read = Promise.withResolvers<IteratorResult<ProcessEvent>>();
  const entered = Promise.withResolvers<void>();
  let stoppedReading = false;
  let killed = false;
  const proxy = createProcessHandleProxy(
    Promise.resolve({
      id: "quiet",
      started: Promise.resolve(),
      exited: new Promise(() => {}),
      write: async () => {},
      end: async () => {},
      kill: async () => {
        killed = true;
      },
      events: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () => {
            entered.resolve();
            return read.promise;
          },
          return: async () => {
            stoppedReading = true;
            const done = { done: true, value: undefined } as const;
            read.resolve(done);
            return done;
          },
        }),
      }),
    }),
  );
  const iterator = proxy.events()[Symbol.asyncIterator]();
  const next = iterator.next();
  await entered.promise;
  const returned = iterator.return!();
  try {
    expect(await Promise.race([Promise.all([next, returned]), Bun.sleep(100).then(() => "pending")])).toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
    expect(stoppedReading).toBe(true);
    expect(killed).toBe(false);
  } finally {
    read.resolve({ done: true, value: undefined });
    await returned;
  }
});

test("an invocation diagnoses a failed child stop and a closed owner can retry it without touching stopped siblings", async () => {
  const failure = new Error("fixture process tree did not stop");
  let tries = 0;
  const exited = Promise.withResolvers<ProcessExit>();
  const failed = createProcessHandleProxy(
    Promise.resolve({
      id: "retry",
      started: Promise.resolve(),
      exited: exited.promise,
      write: async () => {},
      end: async () => {},
      kill: async () => {
        if (++tries === 1) throw failure;
        exited.resolve({ code: null, signal: "SIGTERM" });
      },
      events: async function* () {},
    }),
  );
  const owner = createProcessOwner();
  owner.adopt(failed);
  await failed.started;
  const sibling = {
    exited: new Promise<never>(() => {}),
    kill: async () => {
      siblingStops++;
    },
  };
  let siblingStops = 0;
  owner.adopt(sibling);

  const warnings: string[] = [];
  const scope = createInvocationScope({
    logger: {
      info() {},
      error() {},
      warn(message) {
        warnings.push(message);
      },
    },
  });
  scope.register(owner.close);
  await scope.close();
  expect(warnings).toEqual(["Invocation cleanup failed: Owned process cleanup failed."]);
  expect(owner.closed).toBe(true);
  expect(tries).toBe(1);
  expect(siblingStops).toBe(1);

  await expect(failed.write("late")).rejects.toThrow("closed");
  await owner.close();
  expect(tries).toBe(2);
  expect(siblingStops).toBe(1);
  expect(owner.closed).toBe(true);
});
