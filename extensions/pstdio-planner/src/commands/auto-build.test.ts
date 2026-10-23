import { expect, setSystemTime, test } from "bun:test";
import { listAttempts, putAttempt } from "../data/attempt-storage";
import { putTicket } from "../data/collections";
import { autoBuildCommand } from "./auto-build";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { supervisorFixture } from "./auto-build-supervisor.fixture";

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

test("later wakes query work without repeating the brief or resetting a current scope", async () => {
  const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  const initial = prompts[0]!;
  await autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{}] });
  for (let wake = 0; wake < 2; wake++) {
    sessions.get(initial.sessionId)!.status = "completed";
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true, sessionId: initial.sessionId });
    const followup = prompts.at(-1)!.prompt!;
    expect(followup).not.toContain("Implement relevant tickets.");
    expect(followup).toContain("pst tickets next");
    expect(followup).not.toContain("auto-build scope");
    expect(followup.length).toBeLessThan(initial.prompt!.length / 4);
    expect(await storage.get("auto-build-supervisor")).toMatchObject({ scope: { revision: "test", queries: [{}] } });
  }
  expect(sessions.size).toBe(1);
});

test("changed configuration requests a scope refresh without replaying session instructions", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  const initial = prompts[0]!;
  await autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{}] });
  const mode = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    prompt: "Choose release work.",
    blockOnReview: false,
  });
  sessions.get(initial.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  const changed = prompts.at(-1)!.prompt!;
  expect(changed).toContain("auto-build read");
  expect(changed).toContain("auto-build scope");
  expect(changed).not.toContain("Implement relevant tickets.");
  expect(changed).not.toContain(mode.prompt);
  expect(changed.length).toBeLessThan(initial.prompt!.length / 4);
  await autoBuildScopeCommand.run(ctx, { revision: mode.revision, queries: [{}] });
  sessions.get(initial.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  expect(prompts.at(-1)!.prompt).not.toContain("auto-build scope");
  expect(sessions.size).toBe(1);
});

test("a missing saved scope gets a short setup request on the existing supervisor", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  const initial = prompts[0]!;
  sessions.get(initial.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  expect(prompts.at(-1)!.sessionId).toBe(initial.sessionId);
  expect(prompts.at(-1)!.prompt).toContain("auto-build scope");
  expect(prompts.at(-1)!.prompt).not.toContain("Implement relevant tickets.");
  expect(prompts.at(-1)!.prompt!.length).toBeLessThan(initial.prompt!.length / 4);
});

test("a removed supervisor pauses the run without replacing its ownership ledger", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  const initial = prompts[0]!;
  sessions.delete(initial.sessionId);
  await expect(autoBuildCommand.run(ctx, {})).rejects.toThrow("supervisor was removed");
  expect(prompts).toHaveLength(1);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ state: "paused", enabled: false });
  expect(await ctx.storage.get("auto-build-supervisor")).toMatchObject({ sessionId: initial.sessionId });
});

test("unchanged full-capacity work gets an hourly stalled-progress reminder", async () => {
  const start = Date.parse("2026-10-14T12:00:00Z");
  setSystemTime(start);
  try {
    const { ctx, ticket, sessions, prompts } = await supervisorFixture(1);
    const first = await ticket("First");
    await autoBuildCommand.run(ctx, {});
    const supervisorId = prompts[0]!.sessionId;
    await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
    sessions.get(supervisorId)!.status = "completed";
    setSystemTime(start + 3_600_000 - 1);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
    setSystemTime(start + 3_600_000);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true, sessionId: supervisorId });
    expect(prompts.at(-1)!.prompt).not.toContain("Implement relevant tickets.");
    expect(prompts.at(-1)!.prompt!.length).toBeLessThan(prompts[0]!.prompt!.length / 4);
    sessions.get(supervisorId)!.status = "completed";
    setSystemTime(start + 3_780_000);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
    setSystemTime(start + 7_200_000);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true, sessionId: supervisorId });
  } finally {
    setSystemTime();
  }
});

test("implementation progress postpones an hourly reminder even while capacity is full", async () => {
  const start = Date.parse("2026-10-14T12:00:00Z");
  setSystemTime(start);
  try {
    const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture(1);
    const first = await ticket("First");
    await autoBuildCommand.run(ctx, {});
    const supervisorId = prompts[0]!.sessionId;
    await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
    sessions.get(supervisorId)!.status = "completed";
    setSystemTime(start + 1_800_000);
    const [attempt] = await listAttempts(storage);
    await putAttempt(storage, { ...attempt!, updatedAt: new Date().toISOString() });
    setSystemTime(start + 3_600_000);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
    setSystemTime(start + 5_400_000);
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  } finally {
    setSystemTime();
  }
});

test("sleeps on unchanged active work and resumes the same supervisor when new work becomes valid", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture(3);
  const first = await ticket("First");
  await ticket("Waiting for a slot");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(1);
  await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(2);
  await ticket("Second");
  await autoBuildCommand.run(ctx, {});
  expect(prompts).toHaveLength(3);
  expect(prompts[2]!.sessionId).toBe(prompts[0]!.sessionId);
  expect(sessions.size).toBe(2);
});

test("a failed worker wakes the supervisor while other work is still active", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture(3);
  const first = await ticket("First");
  const second = await ticket("Second");
  await ticket("Remaining work");
  await autoBuildCommand.run(ctx, {});
  const supervisorId = prompts[0]!.sessionId;
  const started = await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
  await autoBuildDispatchCommand.run(ctx, { ticket: second.id, revision: "test" });
  if (started.decision !== "started") throw new Error("Implementation did not start");
  sessions.get(started.sessionId)!.status = "failed";
  sessions.get(supervisorId)!.status = "completed";
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  expect(prompts).toHaveLength(4);
});

test("repeated checks do not wake for startable jobs outside the supervisor scope", async () => {
  const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture();
  const parent = await ticket("Requested project");
  const scoped = await ticket("Waiting for a decision");
  await putTicket(storage, { ...scoped, parentId: parent.id, blockedReason: "Needs a decision" });
  await ticket("Startable job in another project");
  await autoBuildCommand.run(ctx, {});
  await storage.set("auto-build-supervisor", {
    sessionId: prompts[0]!.sessionId,
    scope: { revision: "test", queries: [{ parent: parent.id }] },
  });
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  for (let check = 0; check < 3; check++)
    expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
  expect(prompts).toHaveLength(1);
  await putTicket(storage, { ...scoped, parentId: parent.id });
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
});

test("unchanged actionable work wakes an idle supervisor when no implementations are active", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture();
  await ticket("First");
  await autoBuildCommand.run(ctx, {});
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: true });
  expect(prompts).toHaveLength(2);
});

test("unrelated ticket edits do not wake a supervisor with unchanged active scoped work", async () => {
  const { ctx, ticket, storage, sessions, prompts } = await supervisorFixture(3);
  const parent = await ticket("Requested parent");
  const first = await ticket("Requested worker");
  const next = await ticket("Requested next task");
  await putTicket(storage, { ...first, parentId: parent.id });
  await putTicket(storage, { ...next, parentId: parent.id });
  const unrelated = await ticket("Outside the prompt");
  await autoBuildCommand.run(ctx, {});
  await storage.set("auto-build-supervisor", {
    sessionId: prompts[0]!.sessionId,
    scope: { revision: "test", queries: [{ parent: parent.id }] },
  });
  await autoBuildDispatchCommand.run(ctx, { ticket: first.id, revision: "test" });
  sessions.get(prompts[0]!.sessionId)!.status = "completed";
  await putTicket(storage, { ...unrelated, title: "An unrelated edit" });
  expect(await autoBuildCommand.run(ctx, {})).toMatchObject({ prompted: false });
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
