import { expect, test } from "bun:test";
import { listAttempts, putAttempt } from "../data/attempt-storage";
import { putTicket, tagsCollection } from "../data/collections";
import { seedDefaultTags } from "../data/seed";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand } from "./auto-build-mode";
import { nextTicketsCommand } from "./next-tickets";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";

async function trackFixture() {
  const result = await fixture(6);
  await seedDefaultTags(result.storage);
  await tagsCollection(result.storage).put("track", {
    id: "track",
    name: "Track",
    type: "single_select",
    sortOrder: 3,
    options: [
      { id: "workbench", name: "Workbench", sortOrder: 0, color: "gray", icon: null, description: null },
      { id: "planner", name: "Planner", sortOrder: 1, color: "green", icon: null, description: null },
    ],
  });
  const ticket = async (title: string, track = "workbench", dependsOn: string[] = []) => {
    const created = await result.ticket(title, dependsOn);
    return putTicket(result.storage, { ...created, tagIds: [track] });
  };
  return { ...result, ticket };
}

async function submitDependency(result: Awaited<ReturnType<typeof trackFixture>>) {
  const parent = await result.ticket("Panel rules");
  const started = await runAttemptCommand.run(result.ctx, { ticket: parent.id });
  const attempt = await putAttempt(result.storage, {
    ...started.attempt,
    state: "review_ready",
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "panel-rules-head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "agent", displayName: "Agent" },
        reviews: [],
      },
    ],
  });
  result.ctx.sessions.get = async () => ({
    type: "session",
    id: started.session.id,
    title: "Finished",
    status: "completed",
  });
  return { parent, attempt };
}

test("next tickets query selects a named track and explains its waiting dependencies", async () => {
  const { ctx, ticket } = await trackFixture();
  const ready = await ticket("Owner layout");
  const waiting = await ticket("Panel controls", "workbench", [ready.id]);
  await ticket("Planner task", "planner");
  const result = await nextTicketsCommand.run(ctx, { track: "workbench" });
  expect(result.tickets.map(({ id }) => id)).toEqual([ready.id]);
  expect(result.waiting).toContainEqual(
    expect.objectContaining({
      id: waiting.id,
      reason: "dependency-not-ready",
      dependencyIds: [ready.shorthand],
    }),
  );
  expect(result.capacity).toEqual({ running: 0, limit: 6 });
});

test("next tickets keeps submitted stacks available across track boundaries when review blocking is off", async () => {
  const result = await trackFixture();
  const { parent } = await submitDependency(result);
  await putTicket(result.storage, { ...parent, tagIds: ["planner"] });
  const child = await result.ticket("Panel controls", "workbench", [parent.id]);
  await configureAutoBuildCommand.run(result.ctx, { enabled: false, blockOnReview: false });
  expect(await nextTicketsCommand.run(result.ctx, { track: "Workbench" })).toMatchObject({
    enabled: false,
    tickets: [expect.objectContaining({ id: child.id, action: "start", baseHeadSha: "panel-rules-head" })],
  });
  await configureAutoBuildCommand.run(result.ctx, { enabled: false, blockOnReview: true });
  expect((await nextTicketsCommand.run(result.ctx, { track: "Workbench" })).tickets).toHaveLength(0);
});

test("next tickets offers a combined base for independent submitted branches", async () => {
  const result = await trackFixture();
  const { parent, attempt } = await submitDependency(result);
  const other = await result.ticket("Editor reuse");
  await putAttempt(result.storage, {
    ...attempt,
    ticketId: other.id,
    ticketShorthand: other.shorthand,
    workspaceId: "other-workspace",
    revisions: attempt.revisions.map((revision) => ({ ...revision, headSha: "editor-head" })),
  });
  const child = await result.ticket("Combined layout", "workbench", [parent.id, other.id]);
  result.ctx.process.run = async ({ command }) => ({
    exitCode: command.includes("--is-ancestor") && command.at(-1) !== command.at(-2) ? 1 : 0,
    stdout: "main-sha\n",
    stderr: "",
  });
  await configureAutoBuildCommand.run(result.ctx, { enabled: false, blockOnReview: false });
  const next = await nextTicketsCommand.run(result.ctx, { track: "Workbench" });
  expect(next.tickets).toContainEqual(
    expect.objectContaining({
      id: child.id,
      action: "start",
      baseHeadSha: "main-sha",
    }),
  );
});

test("a changed dependency head prevents dispatching a stale combined base", async () => {
  const result = await trackFixture();
  const { parent, attempt } = await submitDependency(result);
  const other = await result.ticket("Other dependency");
  await putTicket(result.storage, { ...parent, statusId: "done" });
  await putTicket(result.storage, { ...other, statusId: "done" });
  await putAttempt(result.storage, {
    ...attempt,
    ticketId: other.id,
    ticketShorthand: other.shorthand,
    workspaceId: "other-workspace",
    revisions: attempt.revisions.map((revision) => ({ ...revision, headSha: "other-head" })),
  });
  const child = await result.ticket("Combined child", "workbench", [parent.id, other.id]);
  const mode = await configureAutoBuildCommand.run(result.ctx, { enabled: true, blockOnReview: false });
  const run = result.ctx.process.run;
  let changed = false;
  result.ctx.process.run = async (input) => {
    if (input.command.includes("commit-tree") && !changed) {
      changed = true;
      await putAttempt(result.storage, {
        ...attempt,
        revisions: attempt.revisions.map((revision) => ({ ...revision, headSha: "replacement-head" })),
      });
    }
    return run(input);
  };
  await expect(autoBuildDispatchCommand.run(result.ctx, { ticket: child.id, revision: mode.revision })).rejects.toThrow(
    "Work changed before dispatch",
  );
  expect(changed).toBe(true);
  expect((await listAttempts(result.storage)).filter(({ ticketId }) => ticketId === child.id)).toHaveLength(0);
});

test("next tickets respects saved ignore rules, draft state and live assignments", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const ignored = await ticket("Ignored");
  await putTicket(storage, { ...ignored, statusId: "backlog" });
  const draft = await ticket("Draft");
  await putTicket(storage, { ...draft, draft: true });
  const assigned = await ticket("Working");
  ctx.sessions.query = sessionQuery(async () => [
    {
      id: "manual",
      title: "Manual",
      status: "in_progress",
      anchors_json: [{ type: "ticket", id: assigned.id }],
    },
  ]);
  const ready = await ticket("Available");
  const next = await nextTicketsCommand.run(ctx, { track: "Workbench" });
  expect(next.tickets.map(({ id }) => id)).toEqual([ready.id]);
  expect(next.waiting.map(({ id }) => id)).toEqual([assigned.id]);
});

test("next tickets rejects an unknown track rather than querying the whole project", async () => {
  const { ctx, ticket } = await trackFixture();
  await ticket("Ready");
  await expect(nextTicketsCommand.run(ctx, { track: "Unknown" })).rejects.toThrow("Unknown track");
});

test("next tickets combines status, tag and direct parent filters", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const parent = await ticket("Parent");
  const child = await ticket("Child");
  await putTicket(storage, { ...child, parentId: parent.id, tagIds: ["workbench", "default-priority-high"] });
  await ticket("Other child");
  expect(
    (
      await nextTicketsCommand.run(ctx, {
        track: "Workbench",
        status: "Todo",
        tags: ["High"],
        parent: parent.shorthand,
      })
    ).tickets.map(({ id }) => id),
  ).toEqual([child.id]);
});

test("next tickets explains capacity waits without launching work", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const ready = await ticket("Ready");
  await ctx.settings.set("automation.maxInProgress", 0);
  const next = await nextTicketsCommand.run(ctx, { track: "Workbench" });
  expect(next.tickets).toHaveLength(0);
  expect(next.waiting).toContainEqual(expect.objectContaining({ id: ready.id, reason: "capacity-full" }));
  expect(await storage.get("auto-build-supervisor")).toBeUndefined();
});

test("next tickets can explain waits without resolving a Git base when nothing can launch", async () => {
  const { ctx, ticket } = await trackFixture();
  await ticket("Ready");
  await ctx.settings.set("automation.maxInProgress", 0);
  ctx.process.run = async () => {
    throw new Error("No Git repository");
  };
  expect((await nextTicketsCommand.run(ctx, { track: "Workbench" })).waiting).toMatchObject([
    { reason: "capacity-full" },
  ]);
});

test("wake checks, next queries and dispatch share the supervisor scope", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const workbench = await ticket("Requested work");
  const planner = await ticket("Work outside the prompt", "planner");
  await storage.set("auto-build-supervisor", {
    scope: { revision: "test", queries: [{ track: "Workbench" }] },
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toEqual([workbench.id]);
  expect((await nextTicketsCommand.run(ctx, { track: "Planner" })).tickets).toEqual([]);
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: planner.id, revision: "test" })).toMatchObject({
    decision: "wait",
    reason: "ticket-not-ready",
  });
});

test("supervisor scopes combine tracks and expire when the prompt is reconfigured", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const workbench = await ticket("Workbench work");
  const planner = await ticket("Planner work", "planner");
  await storage.set("auto-build-supervisor", {
    scope: { revision: "test", queries: [{ track: "Workbench" }, { track: "Planner" }] },
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toEqual([workbench.id, planner.id]);
  await storage.set("auto-build-supervisor", {
    scope: { revision: "old-prompt", queries: [{ track: "Workbench" }] },
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toEqual([workbench.id, planner.id]);
});

test("a scope change during dispatch prevents launching work outside the new scope", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const task = await ticket("Requested work");
  await ticket("New scope", "planner");
  await storage.set("auto-build-supervisor", {
    scope: { revision: "test", queries: [{ track: "Workbench" }] },
  });
  const run = ctx.process.run;
  let checks = 0;
  ctx.process.run = async (input) => {
    if (input.command.includes("--verify") && ++checks === 2)
      await storage.set("auto-build-supervisor", {
        scope: { revision: "test", queries: [{ track: "Planner" }] },
      });
    return run(input);
  };
  await expect(autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).rejects.toThrow(
    "no longer ready",
  );
  expect(await listAttempts(storage)).toHaveLength(0);
});

test("dependency-only blocker text cannot override current dependency readiness", async () => {
  const { ctx, storage, ticket } = await trackFixture();
  const parent = await ticket("Prerequisite");
  const child = await ticket("Dependent contract", "workbench", [parent.id]);
  await putTicket(storage, {
    ...child,
    blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
  });
  expect((await nextTicketsCommand.run(ctx, {})).waiting).toContainEqual(
    expect.objectContaining({ id: child.id, reason: "dependency-not-ready" }),
  );
  await putTicket(storage, { ...parent, statusId: "done" });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toContain(child.id);
  expect((await ctx.storage.collection("tickets").get(child.id)) as object).toMatchObject({ dependsOn: [parent.id] });
});
