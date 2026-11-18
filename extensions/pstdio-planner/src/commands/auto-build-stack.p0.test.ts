import { expect, test } from "bun:test";
import { putAttempt } from "../data/attempt-storage";
import { fixture } from "./auto-build.fixture";
import { resumeStackRepair } from "./auto-build-stack";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";

test("stack repair cannot resume an owner stopped after its readiness check", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Repair submitted work");
  const started = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(storage, {
    ...started.variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "submitted-head",
        changeRequestReportId: "report",
        submittedAt: new Date().toISOString(),
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  let owner: NonNullable<Awaited<ReturnType<typeof ctx.sessions.get>>> = sessionRecord({
    id: started.session.id,
    title: "Owner",
    status: "completed",
  });
  ctx.sessions.get = async () => owner;
  ctx.sessions.query = sessionQuery(
    async () => [],
    async () => [owner],
  );
  const run = ctx.process.run;
  ctx.process.run = async (input) =>
    input.command.at(-1) === "HEAD" ? { exitCode: 0, stdout: "newer-head\n", stderr: "" } : run(input);
  let followedUp = false;
  ctx.sessions.followup = async ({ expectedRun }) => {
    if (expectedRun && expectedRun.status !== owner.status) throw new Error("Session run changed");
    followedUp = true;
  };
  await expect(
    resumeStackRepair(ctx, started.workspace.id, async () => {
      owner = {
        ...owner,
        status: "cancelled",
        last_exit: { cause: "user_stop", startedAt: null, endedAt: "2026-10-22T10:00:00.000Z" },
      };
    }),
  ).rejects.toThrow("Session run changed");
  expect(followedUp).toBe(false);
});
