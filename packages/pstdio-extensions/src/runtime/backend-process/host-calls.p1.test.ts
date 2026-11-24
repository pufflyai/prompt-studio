import { expect, test } from "bun:test";
import { createProcessHandleProxy } from "../process-owner";
import { createHostCalls, HOST_CALL_LIMITS, type HostInvocation } from "./host-calls";
import { BACKEND_PROTOCOL_VERSION, deserializeBackendError, type HostToWorkerMessage } from "./protocol";
import { FUNCTION_MARKER, type FunctionRef } from "./remote-markers";
import { createFunctionTable, createImportTracker } from "./remote-values";

test("reserves bounded host-call capacity for operations that can release held work", async () => {
  expect(HOST_CALL_LIMITS).toEqual({ inFlight: 4096, cleanupReserve: 256 });
  const defaults = { ...HOST_CALL_LIMITS };
  Object.assign(HOST_CALL_LIMITS, { inFlight: 2, cleanupReserve: 2 });

  const pendingInput = Promise.withResolvers<void>();
  const inputStarted = Promise.withResolvers<void>();
  const ordinary = Promise.withResolvers<void>();
  const closeFirst = Promise.withResolvers<void>();
  const closeLast = Promise.withResolvers<void>();
  let kills = 0;
  const table = createFunctionTable();
  const handle = createProcessHandleProxy(
    Promise.resolve({
      id: "fixture",
      started: Promise.resolve(),
      exited: Promise.resolve({ code: 0, signal: null }),
      write: () => {
        inputStarted.resolve();
        return pendingInput.promise;
      },
      end: async () => {},
      kill: async () => {
        kills++;
      },
      events: async function* () {},
    }),
  );
  const invocation: HostInvocation = {
    context: {},
    surface: { kind: "object", members: {} },
    table,
    tracker: createImportTracker(() => {}),
    enter: (run, ...args) => run(...args),
  };
  const waiting = new Map<string, (reply: Extract<HostToWorkerMessage, { type: "reply" }>) => void>();
  const routed = createHostCalls(
    (message) => {
      if (message.type === "reply") setImmediate(() => waiting.get(message.requestId)?.(message));
      return true;
    },
    () => invocation,
    deserializeBackendError,
    () => {},
  );
  let nextRequest = 0;
  const call = (reference: FunctionRef, args: unknown[] = []) => {
    const requestId = String(nextRequest++);
    const result = Promise.withResolvers<string>();
    waiting.set(requestId, (reply) => {
      waiting.delete(requestId);
      result.resolve(reply.ok ? "ok" : (reply.error.code ?? reply.error.message));
    });
    routed.handle({
      v: BACKEND_PROTOCOL_VERSION,
      type: "fn-call",
      invocationId: "fixture",
      requestId,
      fnId: reference[FUNCTION_MARKER],
      args,
    });
    return result.promise;
  };
  const outcomes: Promise<string>[] = [];
  try {
    const refs = (await table.exportValue({
      write: handle.write,
      end: handle.end,
      kill: handle.kill,
      regular: () => ordinary.promise,
      ordinaryWrite: () => new Promise(() => {}),
      first: { close: () => closeFirst.promise },
      last: { close: () => closeLast.promise },
      next: { close: () => {} },
    })) as Record<string, FunctionRef> & Record<"first" | "last" | "next", { close: FunctionRef }>;
    const write = call(refs.write!, ["pending"]);
    outcomes.push(write);
    await inputStarted.promise;
    const regular = call(refs.regular!);
    outcomes.push(regular);
    // These methods wait for a held write and must leave the cleanup slots available.
    const endings = [call(refs.end!), call(refs.end!)];
    outcomes.push(...endings);
    expect(await call(refs.kill!)).toBe("ok");
    expect(kills).toBe(1);
    expect(await Promise.all(endings)).toEqual(["extension_overloaded", "extension_overloaded"]);
    expect(await call(refs.ordinaryWrite!)).toBe("extension_overloaded");

    const first = call(refs.first.close);
    const last = call(refs.last.close);
    outcomes.push(first, last);
    expect(await call(refs.next.close)).toBe("extension_overloaded");
    closeFirst.resolve();
    expect(await first).toBe("ok");
    expect(await call(refs.next.close)).toBe("ok");
    closeLast.resolve();
    expect(await last).toBe("ok");
    ordinary.resolve();
    pendingInput.resolve();
    expect(await Promise.all([write, regular])).toEqual(["ok", "ok"]);
    expect(await call(refs.regular!)).toBe("ok");
    invocation.cancelled = true;
    expect(await call(refs.kill!)).toBe("This function is no longer available.");
  } finally {
    pendingInput.resolve();
    ordinary.resolve();
    closeFirst.resolve();
    closeLast.resolve();
    await Promise.all(outcomes);
    table.clear();
    Object.assign(HOST_CALL_LIMITS, defaults);
  }
});
