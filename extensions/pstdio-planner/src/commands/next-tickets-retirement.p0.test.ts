import { expect, test } from "bun:test";
import { attemptId } from "../data/attempt-identity";
import { appendAttemptEvent } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { putTicket } from "../data/ticket-context.fixture";
import { fixture } from "./auto-build.fixture";
import { readNextTickets } from "./next-tickets";
import { runAttemptCommand } from "./run-attempt";
import { sessionRecord } from "./session-record.fixture";

test.each([
  "shared folder",
  "legacy workspace",
])("retiring one %s attempt preserves its unfinished sibling in the work scope", async (kind) => {
  const f = await fixture();
  f.ctx.sessions.get = async (id) => sessionRecord({ id, title: "Finished owner", status: "completed" });
  if (kind === "shared folder")
    f.ctx.process.run = async () => ({ exitCode: 1, stdout: "", stderr: "not a git repository" });
  const retired = await f.ticket("Retired task");
  const sibling = await f.ticket("Unfinished sibling");
  const first = await runAttemptCommand.run(f.ctx, { ticket: retired.id });
  const second = await runAttemptCommand.run(f.ctx, { ticket: sibling.id });
  const done = await f.ticket("Delivered task");
  await putTicket(f.storage, { ...retired, statusId: "blocked" });
  await putTicket(f.storage, { ...sibling, statusId: "blocked" });
  await putTicket(f.storage, { ...done, statusId: "done" });
  const event = {
    workspaceId: first.variant.workspaceId,
    revision: null,
    type: "attempt_abandoned" as const,
    actor: { type: "human" as const, id: "user", displayName: "User" },
    sessionId: null,
    reportId: null,
    reviewId: null,
    threadId: null,
    commitSha: null,
    metadata: {},
  };
  await appendAttemptEvent(f.storage, {
    ...event,
    ...(kind === "shared folder" ? { attemptId: attemptId(first.variant) } : {}),
  });
  await appendAttemptEvent(f.storage, {
    ...event,
    attemptId: "unrelated-attempt",
    workspaceId: second.variant.workspaceId,
  });
  const work = await readNextTickets(f.ctx, await readAutoBuildMode(f.ctx), { limit: 0 }, [{}]);
  expect(work.matchingTicketCount).toBe(1);
  expect(work.completed).toBe(false);
});
