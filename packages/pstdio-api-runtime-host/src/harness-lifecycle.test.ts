import { describe, expect, it } from "bun:test";
import type { HarnessExit, JsonPatch } from "pstdio-api-contracts";
import { createEventStore } from "./event-store";
import { resolveHarnessExit } from "./harness-lifecycle";

const patch: JsonPatch = { op: "add", path: "/messages/0", value: { id: "m0" } };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("resolveHarnessExit", () => {
  it("returns the provider exit untouched for provider-managed timeouts", async () => {
    const exit = await resolveHarnessExit({
      session: {
        done: Promise.resolve({ status: "disconnected" }),
        stop: () => {},
        timeoutStrategy: "provider",
      },
      activity: createEventStore().subscribe(),
      timeoutMs: 1,
    });

    expect(exit).toEqual({ status: "disconnected" });
  });

  it("resolves the session exit when done settles before the watchdog", async () => {
    const done = deferred<HarnessExit>();
    const store = createEventStore();
    const pending = resolveHarnessExit({
      session: { done: done.promise, stop: () => {} },
      activity: store.subscribe(),
      timeoutMs: 5_000,
    });

    done.resolve({ status: "completed" });

    expect(await pending).toEqual({ status: "completed" });
  });

  it("stops the session and fails when no activity arrives in time", async () => {
    let stopped = false;
    let timedOut = false;
    const store = createEventStore();

    const exit = await resolveHarnessExit({
      session: {
        done: new Promise<HarnessExit>(() => {}),
        stop: () => {
          stopped = true;
        },
      },
      activity: store.subscribe(),
      timeoutMs: 10,
      onTimeout: () => {
        timedOut = true;
      },
    });

    expect(exit).toEqual({ status: "failed" });
    expect(stopped).toBe(true);
    expect(timedOut).toBe(true);
  });

  it("keeps the session alive while events keep arriving", async () => {
    const done = deferred<HarnessExit>();
    const store = createEventStore();
    const pending = resolveHarnessExit({
      session: { done: done.promise, stop: () => {} },
      activity: store.subscribe(),
      timeoutMs: 40,
    });

    for (let i = 0; i < 4; i += 1) {
      await new Promise((r) => setTimeout(r, 25));
      store.push(patch);
    }

    done.resolve({ status: "completed" });

    expect(await pending).toEqual({ status: "completed" });
  });
});
