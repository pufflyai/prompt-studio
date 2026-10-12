import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";

async function supervisorFixture(limit = 2) {
  const result = await fixture(limit);
  const sessions = new Map<string, { id: string; title: string; status: string }>();
  const prompts: { sessionId: string; prompt?: string }[] = [];
  result.ctx.sessions.create = async (input) => {
    const session = {
      type: "session" as const,
      id: `supervisor-${sessions.size}`,
      title: input.title,
      status: "in_progress" as const,
    };
    sessions.set(session.id, session);
    prompts.push({ sessionId: session.id, prompt: input.prompt });
    return session;
  };
  result.ctx.sessions.get = async (id) => sessions.get(id) ?? null;
  result.ctx.sessions.followup = async (input) => {
    prompts.push(input);
    sessions.get(input.sessionId)!.status = "in_progress";
  };
  return { ...result, sessions, prompts };
}

test("starts one supervisor with the user prompt instead of dispatching implementation itself", async () => {
  const { ctx, ticket, storage, prompts } = await supervisorFixture();
  await ticket("First");
  await configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Choose small tasks first." });
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
  expect(prompts[0]!.prompt).toContain("Choose small tasks first.");
  expect(await listAttempts(storage)).toHaveLength(0);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    supervisor: { id: prompts[0]!.sessionId, status: "in_progress" },
  });
});

test("sleeps on unchanged boards and resumes the same supervisor when new work becomes valid", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
  expect(prompts[1]!.sessionId).toBe(prompts[0]!.sessionId);
  expect(sessions.size).toBe(1);
});

test("defers board changes until the running supervisor ends its turn", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
});

test("waits with no eligible work or no implementation capacity", async () => {
  const { ctx, ticket, prompts } = await supervisorFixture(0);
  await autoBuildCommand.run(ctx, {});
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(0);
  await ctx.settings.set("automation.maxInProgress", 1);
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
});

test("concurrent checks create only one supervisor", async () => {
  const { ctx, ticket, prompts } = await supervisorFixture();
  await ticket("First");
  await Promise.all([autoBuildCommand.run(ctx, {}), autoBuildCommand.run(ctx, {}), autoBuildCommand.run(ctx, {})]);
  expect(prompts).toHaveLength(1);
});

test("stop leaves running sessions intact and suppresses future wakeups", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(sessions.get(prompts[0]!.sessionId)!.status).toBe("in_progress");
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
});

test("a failed supervisor wake pauses the mode for inspection", async () => {
  const { ctx, ticket } = await supervisorFixture();
  await ticket("First");
  ctx.sessions.create = async () => {
    throw new Error("Agent unavailable");
  };
  await expect(autoBuildCommand.run(ctx, {})).rejects.toThrow("Agent unavailable");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("reuses the supervisor when an implementation frees capacity without a ticket edit", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture(1);
  const first = await ticket("First");
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  const supervisorId = prompts[0]!.sessionId;
  const { autoBuildDispatchCommand } = await import("./auto-build-dispatch");
  const attempt = await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
  expect(attempt.decision).toBe("started");
  if (attempt.decision !== "started") throw new Error("Implementation did not start");
  sessions.get(supervisorId)!.status = "completed";
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
  sessions.get(attempt.sessionId)!.status = "completed";
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true, sessionId: supervisorId });
});

test("stopping during an in-flight wake preserves the session without re-enabling the mode", async () => {
  const { ctx, ticket, prompts } = await supervisorFixture();
  await ticket("First");
  const create = ctx.sessions.create;
  ctx.sessions.create = async (input) => {
    await configureAutoBuildCommand.run(ctx, { enabled: false });
    return create(input);
  };
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    supervisor: { id: prompts[0]!.sessionId },
  });
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
});
