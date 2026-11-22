import { expect, spyOn, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createMachineHarness } from "./agent";
import { fileTurnFixture } from "./file-turns.test-fixture";
import { createMachineCommands } from "./machine-commands";
import { createMachineWatch } from "./machine-watch";
import type { ControllerMachine } from "./machines";

test("a conversation lookup failure does not create an unbound session", async () => {
  const f = await fileTurnFixture((request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/conversations"))
      return Response.json({ error: { code: "lookup_failed", message: "Conversation unavailable" } }, { status: 503 });
    if (path.endsWith("/capabilities")) return Response.json({ requests: true });
    return Response.json({ id: f.ref.machineId, external_id: "Agent", state: "ready", metadata: {} });
  });
  let created = 0;
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  ctx.sessions.create = async () => {
    created++;
    throw new Error("Session should not be created before the lookup succeeds");
  };
  try {
    const commands = createMachineCommands(() => f.ref.instances);
    await expect(
      commands.connectMachine.run(ctx, { instance: f.ref.instanceId, machineId: f.ref.machineId }),
    ).rejects.toThrow("Conversation unavailable");
    expect(created).toBe(0);
  } finally {
    await f.close();
  }
});

test("disposing a restored machine run cancels its conversation probe", async () => {
  const f = await fileTurnFixture(() => Response.json({}));
  const entered = Promise.withResolvers<AbortSignal | undefined>();
  const probe = Promise.withResolvers<never>();
  const harness = createMachineHarness(() => ({
    ...f.ref.instances,
    request: async <T>(_instance: string, _path: string, options?: RequestInit): Promise<T> => {
      const signal = options?.signal ?? undefined;
      entered.resolve(signal);
      signal?.addEventListener("abort", () => probe.reject(signal.reason), { once: true });
      return probe.promise;
    },
  }));
  await f.ref.instances.bindSession(f.input.sessionId, f.ref.instanceId, f.ref.machineId);
  const starting = harness.resume(f.ctx, { ...f.input, agentSessionId: "previous:machine:conversation" });
  const outcome = starting.catch((error: unknown) => error);
  try {
    expect(await entered.promise).toBeDefined();
    await harness.dispose?.(f.ctx);
    expect(await outcome).toBeInstanceOf(DOMException);
    expect(((await outcome) as DOMException).name).toBe("AbortError");
  } finally {
    probe.reject(new Error("Fixture cleanup"));
    await outcome;
    await harness.dispose?.(f.ctx);
    await f.close();
  }
});

test("a timed-out machine watch request retries with its existing transport deadline", async () => {
  const f = await fileTurnFixture(() => Response.json({}));
  const deadlines: number[] = [];
  const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
  const timeout = spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    deadlines.push(milliseconds);
    return new AbortController().signal;
  });
  let reads = 0;
  const watch = createMachineWatch(() => ({
    ...f.ref.instances,
    request: async <T>(_instance: string, _path: string, options?: RequestInit): Promise<T> => {
      expect(options?.signal).toBeDefined();
      reads++;
      if (reads === 2) throw new DOMException("Transport deadline", "TimeoutError");
      const machine = { id: f.ref.machineId, state: reads === 1 ? "ready" : "succeeded", change_cursor: reads };
      return (reads === 1 ? machine : { workspace: machine, changed: true }) as T;
    },
  }));
  try {
    expect(await watch.run(ctx, { instance: f.ref.instanceId, machineId: f.ref.machineId })).toMatchObject({
      state: "succeeded" satisfies ControllerMachine["state"],
    });
    expect(reads).toBe(3);
    expect(deadlines).toEqual([35_000, 35_000, 35_000]);
  } finally {
    timeout.mockRestore();
    await f.close();
  }
});
