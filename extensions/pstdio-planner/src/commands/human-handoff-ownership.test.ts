import { expect, test } from "bun:test";
import { fixture } from "./auto-build.fixture";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";
import { sessionRecord } from "./session-record.fixture";

async function ownedWork() {
  const f = await fixture();
  const ticket = await f.ticket("Repair the stack");
  const attempt = await runAttemptCommand.run(f.ctx, { ticket: ticket.id });
  const followups: string[] = [];
  f.ctx.sessions.get = async (id) =>
    sessionRecord({
      id,
      title: "Owner",
      status: "completed",
      anchors_json: [{ type: "planner-attempt", id: attempt.workspace.id }],
    });
  f.ctx.sessions.create = async () => {
    throw new Error("Do not replace the owning session.");
  };
  f.ctx.sessions.addAnchors = async () => {};
  f.ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
  };
  const input = {
    ticket: ticket.id,
    workspaceId: attempt.workspace.id,
    sessionId: attempt.session.id,
    title: "Resolve the conflict",
    instructions: "Choose the required behavior.",
    request: { kind: "task" as const },
  };
  return { ...f, input, followups };
}

test("a phase-free human handoff reuses the workspace owner", async () => {
  const f = await ownedWork();
  const request = await requestHumanCommand.run(f.ctx, f.input);
  expect(request.context.sessionId).toBe(f.input.sessionId);
  expect(f.followups).toEqual([f.input.sessionId]);
});

test("a phase-free human handoff validates ticket and revision ownership", async () => {
  const f = await ownedWork();
  const other = await f.ticket("Other ticket");
  const wrongTicket = await Promise.resolve(requestHumanCommand.run(f.ctx, { ...f.input, ticket: other.id })).catch(
    (error) => error,
  );
  expect(wrongTicket).toMatchObject({ message: expect.stringContaining("handoff") });
  const wrongRevision = await Promise.resolve(requestHumanCommand.run(f.ctx, { ...f.input, revision: 99 })).catch(
    (error) => error,
  );
  expect(wrongRevision).toMatchObject({ message: expect.stringContaining("revision") });
  expect(f.followups).toEqual([]);
});
