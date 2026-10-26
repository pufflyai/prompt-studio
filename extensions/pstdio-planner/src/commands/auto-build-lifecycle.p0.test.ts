import { expect, test } from "bun:test";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import { autoBuildCommand } from "./auto-build";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { pauseAutoBuildCommand, resumeAutoBuildCommand } from "./auto-build-lifecycle";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { supervisorFixture } from "./auto-build-supervisor.fixture";

const started = async () => {
  const result = await supervisorFixture();
  const task = await result.ticket("Build the tool");
  await autoBuildCommand.run(result.ctx, {});
  return { ...result, task };
};

test("pause gates dispatch and wake without cancelling sessions or losing scope", async () => {
  const { ctx, storage, task, sessions, prompts } = await started();
  const mode = await readAutoBuildMode(ctx);
  const owner = await readAutoBuildSupervisor(ctx);
  const scope = { revision: mode.revision, queries: [{ track: "Tools" }] };
  await storage.set("auto-build-supervisor", { ...owner, scope });
  await pauseAutoBuildCommand.run(ctx, {});
  expect(await readAutoBuildMode(ctx)).toMatchObject({ state: "paused", enabled: false, revision: mode.revision });
  expect(await readAutoBuildSupervisor(ctx)).toEqual({ ...owner, scope });
  expect([...sessions.values()].every((session) => session.status === "in_progress")).toBe(true);
  expect(await autoBuildCommand.run(ctx, {})).toEqual({ prompted: false });
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: mode.revision })).toMatchObject({
    decision: "wait",
  });
  expect(prompts).toHaveLength(1);
});

test("resume continues the same run and requeues a wake without replacing its owner", async () => {
  const { ctx, storage } = await started();
  const owner = await readAutoBuildSupervisor(ctx);
  const mode = await readAutoBuildMode(ctx);
  await storage.set("auto-build-supervisor", { ...owner, scope: { revision: mode.revision, queries: [{}] } });
  const enqueued: unknown[] = [];
  ctx.automation.enqueue = async (input) => {
    enqueued.push(input);
    return {} as never;
  };
  await pauseAutoBuildCommand.run(ctx, {});
  await resumeAutoBuildCommand.run(ctx, {});
  const resumed = await readAutoBuildMode(ctx);
  expect(resumed).toMatchObject({ state: "running", enabled: true });
  expect(resumed.revision).not.toBe(mode.revision);
  expect(await readAutoBuildSupervisor(ctx)).toMatchObject({
    sessionId: owner.sessionId,
    scope: { revision: resumed.revision, queries: [{}] },
  });
  expect(enqueued).toHaveLength(1);
});

test("pause remains available while a dispatch is finishing ownership writes", async () => {
  const { ctx } = await started();
  const finish = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const dispatch = withWriteGuard(ctx, "attempt-launch", async () => {
    entered.resolve();
    await finish.promise;
  });
  await entered.promise;
  try {
    expect(await pauseAutoBuildCommand.run(ctx, {})).toMatchObject({ state: "paused" });
  } finally {
    finish.resolve();
    await dispatch;
  }
});

for (const status of ["completed", "in_progress"] as const) {
  test(`restarting creates a fresh supervisor when the old session is ${status}`, async () => {
    const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture();
    await ticket("Ready work");
    await autoBuildCommand.run(ctx, {});
    const previous = prompts[0]!.sessionId;
    sessions.get(previous)!.status = status;
    await storage.set("auto-build-supervisor", {
      sessionId: previous,
      lastWake: "previous-run",
      scope: { revision: "test", queries: [{ status: "Blocked" }] },
    });
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Start the new brief." });
    expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ supervisor: null });
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
    const current = prompts.at(-1)!;
    expect(current.sessionId).not.toBe(previous);
    expect(current.prompt).toContain("Start the new brief.");
    expect(sessions.get(previous)!.status).toBe(status);
    sessions.get(current.sessionId)!.status = "completed";
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ sessionId: current.sessionId });
  });
}

test("a restart cannot be overwritten by a wake that is still creating its supervisor", async () => {
  const { ctx, ticket, prompts } = await supervisorFixture();
  await ticket("Ready work");
  const create = ctx.sessions.create;
  let rejectedStart: unknown;
  ctx.sessions.create = async (input) => {
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    try {
      await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "New run" });
    } catch (error) {
      rejectedStart = error;
    }
    return create(input);
  };
  await autoBuildCommand.run(ctx, {});
  expect(rejectedStart).toBeInstanceOf(Error);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
  ctx.sessions.create = create;
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "New run" });
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
  expect(prompts[1]!.sessionId).not.toBe(prompts[0]!.sessionId);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    supervisor: { id: prompts[1]!.sessionId },
  });
});

test("resume preserves scope written by an in-flight wake before refreshing the revision", async () => {
  const { ctx, storage } = await started();
  await pauseAutoBuildCommand.run(ctx, {});
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const wake = withWriteGuard(ctx, "auto-build-supervisor", async () => {
    entered.resolve();
    await finish.promise;
    await storage.set("auto-build-supervisor", {
      sessionId: "late-supervisor",
      scope: { revision: "old", queries: [{ track: "Tools" }] },
    });
  });
  await entered.promise;
  const resume = resumeAutoBuildCommand.run(ctx, {});
  finish.resolve();
  await wake;
  const mode = await resume;
  expect(await readAutoBuildSupervisor(ctx)).toMatchObject({
    sessionId: "late-supervisor",
    scope: { revision: mode.revision, queries: [{ track: "Tools" }] },
  });
});

test("resume survives a wake consumed while the supervisor is finishing its paused turn", async () => {
  const { ctx, task, sessions, prompts } = await started();
  const { autoBuildSessionCompletedHook, checkAutoBuildCommand } = await import("../hooks/auto-build");
  const owner = await readAutoBuildSupervisor(ctx);
  const supervisor = sessions.get(owner.sessionId!)!;
  const enqueued: unknown[] = [];
  ctx.automation.enqueue = async (input) => {
    enqueued.push(input);
    return {} as never;
  };
  await pauseAutoBuildCommand.run(ctx, {});
  expect(
    await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: (await readAutoBuildMode(ctx)).revision }),
  ).toMatchObject({ decision: "wait" });
  await resumeAutoBuildCommand.run(ctx, {});
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
  expect(prompts).toHaveLength(1);
  supervisor.status = "completed";
  await autoBuildSessionCompletedHook.run(
    { ...ctx, eventId: "pstdio.event.session.completed", deliveryId: "completion" },
    {
      sessionId: supervisor.id,
      projectId: "proj-1",
      sessionStatus: "completed",
    },
  );
  expect(enqueued).toHaveLength(2);
  await checkAutoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
  supervisor.status = "completed";
  await checkAutoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
});
