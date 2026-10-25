import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { putTicket } from "../data/ticket-context.fixture";

import { registerGate } from "../timeline/commands/gate-store";
import { fixture } from "./auto-build.fixture";
import { autoBuildCandidatesCommand } from "./auto-build-candidates";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { configureAutoBuildCommand } from "./auto-build-mode";
import { createTicketCommand } from "./create-ticket";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";

const dispatch = (ctx: Awaited<ReturnType<typeof fixture>>["ctx"], ticket: string, revision = "test") =>
  autoBuildDispatchCommand.run(ctx, { ticket, revision });

test("candidates include unattended In Progress and exclude ineligible statuses, drafts, gates, blockers, and human requests", async () => {
  const { ctx, storage, ticket } = await fixture(10);
  await createTicketCommand.run(ctx, { title: "Backlog" });
  await createTicketCommand.run(ctx, { title: "Done", statusId: "done" });
  const draft = await ticket("Draft");
  await putTicket(storage, { ...draft, draft: true });
  const blocked = await ticket("Blocked");
  await putTicket(storage, { ...blocked, blockedReason: "Credentials" });
  const gate = await ticket("Gate");
  await registerGate(ctx, gate.id);
  const human = await ticket("Question");
  await requestHumanCommand.run(ctx, {
    ticket: human.id,
    title: "Confirm",
    instructions: "Choose scope",
    request: { kind: "task" },
  });
  const orphan = await ticket("Unattended");
  await putTicket(storage, { ...orphan, statusId: "in-progress" });
  const ready = await ticket("Ready");
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([orphan.id, ready.id]);
});

test("eligible ticket exclusions are enforced when reading and dispatching tickets", async () => {
  const { ctx, ticket } = await fixture();
  const ignored = await ticket("Postpone this task");
  const allowed = await ticket("Ship this task");
  const mode = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: {
      conjunction: "and",
      rules: [{ attributeId: "title", condition: "does-not-contain", value: "Postpone" }],
    },
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([allowed.id]);
  expect(await dispatch(ctx, ignored.id, mode.revision)).toMatchObject({
    decision: "wait",
    reason: "ticket-not-ready",
  });
});

test("tickets assigned to an ordinary live session are not dispatched", async () => {
  const { ctx, ticket } = await fixture();
  const assigned = await ticket("Already working");
  const ready = await ticket("Ready");
  ctx.sessions.query = sessionQuery(async () => [
    { id: "ordinary", title: "Work", status: "in_progress", anchors_json: [{ type: "ticket", id: assigned.id }] },
  ]);
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([ready.id]);
  expect(await dispatch(ctx, assigned.id)).toMatchObject({ decision: "wait" });
});

test("concurrent manual and supervisor dispatches cannot exceed implementation capacity", async () => {
  const { ctx, ticket, storage } = await fixture(1);
  const first = await ticket("First");
  const second = await ticket("Second");
  const outcomes = await Promise.allSettled([
    dispatch(ctx, first.id),
    runAttemptCommand.run(ctx, { ticket: second.id }),
  ]);
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(await listAttempts(storage)).toHaveLength(1);
});

test("dispatch checks live capacity, ignores existing attempts, and preserves dependency readiness", async () => {
  const { ctx, ticket, storage } = await fixture(1);
  const prerequisite = await ticket("Prerequisite");
  const dependent = await ticket("Dependent", [prerequisite.shorthand]);
  const other = await ticket("Independent");
  expect(await dispatch(ctx, dependent.id)).toMatchObject({ decision: "wait", reason: "ticket-not-ready" });
  expect(await dispatch(ctx, prerequisite.id)).toMatchObject({ decision: "started" });
  expect(await dispatch(ctx, other.id)).toMatchObject({ decision: "wait", reason: "capacity-full" });
  expect(await listAttempts(storage)).toHaveLength(1);
});

test("stopping or restarting rejects dispatch from an old supervisor prompt", async () => {
  const { ctx, ticket, storage } = await fixture();
  const task = await ticket("Ready");
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  expect(await dispatch(ctx, task.id)).toMatchObject({ reason: "auto-build-stopped" });
  await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(await dispatch(ctx, task.id)).toMatchObject({ reason: "auto-build-stopped" });
  expect(await listAttempts(storage)).toHaveLength(0);
});

test("a board change during readiness prevents a launch that is no longer valid", async () => {
  const { ctx, ticket, storage } = await fixture();
  const task = await ticket("Ready");
  const run = ctx.process.run;
  let checks = 0;
  ctx.process.run = async (input) => {
    if (input.command.includes("--verify") && ++checks === 2) await putTicket(storage, { ...task, statusId: "done" });
    return run(input);
  };
  await expect(dispatch(ctx, task.id)).rejects.toThrow("no longer ready");
  expect(await listAttempts(storage)).toHaveLength(0);
});

test("empty advanced eligible groups include valid tickets", async () => {
  const { ctx, ticket } = await fixture();
  const ready = await ticket("Ready");
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [], groups: [{ conjunction: "and", rules: [] }] },
  });
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([ready.id]);
});

test("a Blocked status prevents assignment without a written blocker", async () => {
  const { ctx, ticket } = await fixture();
  const blocked = await createTicketCommand.run(ctx, { title: "Blocked by status", statusId: "blocked" });
  const ready = await ticket("Ready");
  expect((await autoBuildCandidatesCommand.run(ctx, {})).candidates.map(({ id }) => id)).toEqual([ready.id]);
  expect(await dispatch(ctx, blocked.id)).toMatchObject({ decision: "wait", reason: "ticket-not-ready" });
});
