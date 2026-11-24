import { expect, test } from "bun:test";
import type { HarnessExit } from "pstdio-api-contracts";
import type {
  HarnessContext,
  HarnessProvider,
  ProcessExit,
  ProcessHandle,
  ProcessSpawnInput,
} from "pstdio-api-contracts/extension-kernel";
import type { ProcessOwner, RuntimeHarnessRecord } from "pstdio-extensions";
import { createHarnessRegistry } from "./harness-registry";

type Child = { name: string; handle: ProcessHandle; killed: boolean; workspaceId?: string };

// Mirrors the host's harness process API: the instance owner holds every child as a backstop.
const harness = (provider: Partial<HarnessProvider>) => {
  const children: Child[] = [];
  const spawnFor = (owner: ProcessOwner) => (input: ProcessSpawnInput) => {
    const exited = Promise.withResolvers<ProcessExit>();
    const child: Child = {
      name: input.command[0]!,
      workspaceId: input.workspaceId,
      killed: false,
      handle: {
        id: crypto.randomUUID(),
        started: Promise.resolve(),
        exited: exited.promise,
        write: async () => {},
        end: async () => {},
        kill: async () => {
          child.killed = true;
          exited.resolve({ code: null, signal: "SIGTERM" });
        },
        events: async function* () {},
      },
    };
    children.push(child);
    owner.adopt(child.handle);
    return child.handle;
  };
  const record: RuntimeHarnessRecord = {
    id: "test.agent.harness.agent",
    localId: "agent",
    extensionId: "test.agent",
    name: "agent",
    sourcePath: "/fake/agent/extension.ts",
    provider: {
      id: "agent",
      ref: { kind: "harness", id: "agent" },
      label: "Agent",
      capabilities: () => [],
      start: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
      resume: () => ({ done: Promise.resolve({ status: "completed" }), stop: () => {} }),
      ...provider,
    },
  };
  const registry = createHarnessRegistry(
    [record],
    (_record, options, owner) =>
      ({
        projectId: options?.projectId,
        process: { spawn: spawnFor(owner) },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      }) as unknown as HarnessContext,
  );
  const killed = (name: string) => children.find((child) => child.name === name)?.killed;
  return { registry, handle: registry.list()[0]!, killed, children };
};

const startInput = { prompt: "go", sessionId: "s1", events: { push: () => {}, getMessages: () => [] } };
const settle = () => Bun.sleep(10);

test("a turn's call children live until its done settles, not until start returns", async () => {
  const done = Promise.withResolvers<HarnessExit>();
  const { registry, handle, killed } = harness({
    start: (ctx) => {
      ctx.process.spawn({ command: ["turn"] });
      ctx.process.spawn({ command: ["server"], lifetime: "extension" });
      return { done: done.promise, stop: () => {} };
    },
  });
  await handle.start(startInput, { projectId: "p1" });
  await settle();
  expect(killed("turn")).toBe(false);
  done.resolve({ status: "completed" });
  await settle();
  expect(killed("turn")).toBe(true);
  expect(killed("server")).toBe(false);
  await registry.dispose();
  expect(killed("server")).toBe(true);
});

test("a detection child ends when detection settles; a later spawn from that call is refused", async () => {
  let detectContext: HarnessContext | undefined;
  const { registry, handle, killed } = harness({
    detect: (ctx) => {
      detectContext = ctx;
      ctx.process.spawn({ command: ["probe"] });
      return { available: true };
    },
  });
  await handle.detect();
  await settle();
  expect(killed("probe")).toBe(true);
  const late = detectContext!.process.spawn({ command: ["late"] });
  await expect(late.started).rejects.toMatchObject({ code: "process_owner_closed" });
  expect(killed("late")).toBeUndefined();
  await registry.dispose();
});

test("a native command's children live from preparation until the turn it starts is done", async () => {
  const done = Promise.withResolvers<HarnessExit>();
  const { registry, handle, killed } = harness({
    prepareOperation: (ctx) => {
      ctx.process.spawn({ command: ["prepared"] });
      return {
        execution: "exclusive",
        invoke: async () => ({ kind: "started", session: { done: done.promise, stop: () => {} } }),
      };
    },
  });
  const prepared = await handle.prepareOperation({ sessionId: "s1" }, { kind: "command", text: "/review" });
  await prepared.invoke({ events: { push: () => {}, getMessages: () => [] } });
  await settle();
  expect(killed("prepared")).toBe(false);
  done.resolve({ status: "completed" });
  await settle();
  expect(killed("prepared")).toBe(true);
  await registry.dispose();
});

test("disposing a harness stops call children of a turn that never finished", async () => {
  const { registry, handle, killed } = harness({
    start: (ctx) => {
      ctx.process.spawn({ command: ["stuck-turn"] });
      return { done: new Promise<HarnessExit>(() => {}), stop: () => {} };
    },
  });
  await handle.start(startInput, { projectId: "p1" });
  await registry.dispose();
  expect(killed("stuck-turn")).toBe(true);
});

test("releasing a prepared operation that was never invoked stops its children; after invoke it has no effect", async () => {
  const done = Promise.withResolvers<HarnessExit>();
  let operations = 0;
  const { registry, handle, killed } = harness({
    prepareOperation: (ctx) => {
      ctx.process.spawn({ command: [`op-${++operations}`] });
      return {
        execution: "exclusive",
        invoke: async () => ({ kind: "started", session: { done: done.promise, stop: () => {} } }),
      };
    },
  });
  const abandoned = await handle.prepareOperation({ sessionId: "s1" }, { kind: "command", text: "/review" });
  abandoned.release();
  await settle();
  expect(killed("op-1")).toBe(true);

  const invoked = await handle.prepareOperation({ sessionId: "s1" }, { kind: "command", text: "/review" });
  await invoked.invoke({ events: { push: () => {}, getMessages: () => [] } });
  invoked.release();
  await settle();
  expect(killed("op-2")).toBe(false);
  done.resolve({ status: "completed" });
  await settle();
  expect(killed("op-2")).toBe(true);
  await registry.dispose();
});

test("native calls default spawn to their own workspace while permitting an explicit selection", async () => {
  const workspace = {
    workspaceId: "remote-session",
    executionTarget: { kind: "remote", providerId: "test.remote", providerRef: { version: 1, data: {} } },
  } as const;
  const run = (ctx: HarnessContext) => {
    ctx.process.spawn({ command: ["default"] });
    ctx.process.spawn({ command: ["other"], workspaceId: "other-workspace" });
    return { done: Promise.resolve({ status: "completed" as const }), stop: () => {} };
  };
  const { registry, handle, children } = harness({
    start: run,
    resume: run,
    reattach: run,
    prepareOperation: (ctx) => {
      ctx.process.spawn({ command: ["prepared"] });
      return { execution: "exclusive", invoke: async () => ({ kind: "completed" }) };
    },
    detect: (ctx) => {
      ctx.process.spawn({ command: ["detect"] });
      return { available: true };
    },
  });
  try {
    await handle.start({ ...startInput, workspace });
    await handle.resume({ ...startInput, workspace, agentSessionId: "agent-session" });
    await handle.reattach({ ...startInput, workspace, agentSessionId: "agent-session" });
    const prepared = await handle.prepareOperation(
      { sessionId: startInput.sessionId, workspace },
      { kind: "command", text: "/review" },
    );
    prepared.release();
    await handle.detect();
    expect(children.map(({ workspaceId }) => workspaceId)).toEqual([
      "remote-session",
      "other-workspace",
      "remote-session",
      "other-workspace",
      "remote-session",
      "other-workspace",
      "remote-session",
      undefined,
    ]);
  } finally {
    await registry.dispose();
  }
});

test("request cancellation stops the child even before native start returns", async () => {
  const started = Promise.withResolvers<void>();
  const controller = new AbortController();
  const done = Promise.withResolvers<HarnessExit>();
  const { registry, handle, killed } = harness({
    async start(ctx) {
      const child = ctx.process.spawn({ command: ["starting-turn"] });
      ctx.process.spawn({ command: ["shared-server"], lifetime: "extension" });
      started.resolve();
      await child.exited;
      return { done: done.promise, stop: () => {} };
    },
  });
  try {
    const run = handle.start({ ...startInput, signal: controller.signal });
    await started.promise;
    controller.abort();
    await settle();
    expect(killed("starting-turn")).toBe(true);
    expect(killed("shared-server")).toBe(false);
    await run;
  } finally {
    done.resolve({ status: "cancelled" });
    await registry.dispose();
  }
});

test("account cancellation and command-watch release stop their call children", async () => {
  const started = Promise.withResolvers<void>();
  const controller = new AbortController();
  const { registry, handle, killed } = harness({
    async authenticate(ctx) {
      const child = ctx.process.spawn({ command: ["login"] });
      started.resolve();
      await child.exited;
    },
    watchCommandState(ctx) {
      ctx.process.spawn({ command: ["watch"] });
      return () => {};
    },
  });
  try {
    const flow = handle.authenticate!(
      { action: "login", provider: "test", method: "fixture" },
      {
        signal: controller.signal,
        emit: async () => {},
        request: async () => "",
      },
    );
    await started.promise;
    const closeWatch = await handle.watchCommandState!({ sessionId: startInput.sessionId }, () => {});
    controller.abort();
    closeWatch();
    await settle();
    expect(killed("login")).toBe(true);
    expect(killed("watch")).toBe(true);
    await flow;
  } finally {
    await registry.dispose();
  }
});
