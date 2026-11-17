import { expect, test } from "bun:test";
import { fixture } from "./auto-build.fixture";
import { repairAttempt } from "./repair-attempt";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";

test("repair checks competing live writers without loading completed workspace history", async () => {
  const f = await fixture();
  const ticket = await f.ticket("Repair owned work");
  const started = await runAttemptCommand.run(f.ctx, { ticket: ticket.id });
  let otherActive = true;
  const history = Array.from({ length: 5000 }, (_, i) =>
    sessionRecord({ id: `completed-${i}`, title: "Old", status: "completed" }),
  );
  const owner = sessionRecord({ ...started.session, status: "in_progress" });
  const query = sessionQuery(async () => [
    ...history,
    sessionRecord({ id: "competitor", title: "Other", status: otherActive ? "in_progress" : "completed" }),
    owner,
  ]);
  f.ctx.sessions.get = async () => owner;
  let workspaceQueries = 0;
  f.ctx.sessions.query = async (input) => {
    if (input?.workspaceId) {
      workspaceQueries++;
      expect(input.status).toEqual(["queued", "in_progress", "awaiting_input"]);
      expect(input.includeArchived).toBe(true);
      expect(input.limit).toBe(2);
    }
    return query(input);
  };
  let followups = 0;
  f.ctx.sessions.followup = async () => {
    followups++;
  };
  const input = { workspaceId: started.variant.workspaceId, expectedHeadSha: "main-sha", reason: "Fix the failure" };
  await expect(repairAttempt(f.ctx, input)).rejects.toThrow("Another session");
  expect(followups).toBe(0);
  otherActive = false;
  expect(await repairAttempt(f.ctx, input)).toMatchObject({ decision: "queued", sessionId: owner.id });
  expect(workspaceQueries).toBe(2);
  expect(followups).toBe(1);
});
