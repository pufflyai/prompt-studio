import { expect, test } from "bun:test";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { readAutoBuildOwnership } from "../data/auto-build-ownership";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { readAttemptHistoryCommand } from "./attempt-history";
import { autoBuildCommand } from "./auto-build";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { pauseAutoBuildCommand } from "./auto-build-lifecycle";
import { readAutoBuildResumptions, resumeAutoBuildAttempt } from "./auto-build-resume";
import { stopAutoBuildCommand } from "./auto-build-stop";
import { supervisorFixture } from "./auto-build-supervisor.fixture";
import { requestReviewCommand, reviewCommand } from "./review-requests";
import { sessionRecord } from "./session-record.fixture";

test("Auto Build owns, resumes and stops distinct folder attempts while its supervisor stays active", async () => {
  const f = await supervisorFixture();
  f.ctx.process.run = async () => ({ exitCode: 1, stdout: "", stderr: "not a git repository" });
  f.ctx.workspaces.create = async () => {
    throw new Error("Reuse the project folder");
  };
  const first = await f.ticket("First folder task");
  const second = await f.ticket("Second folder task");
  await autoBuildCommand.run(f.ctx, {});
  const supervisor = (await readAutoBuildSupervisor(f.ctx)).sessionId!;
  const dispatch = async (ticket: string) => {
    const result = await autoBuildDispatchCommand.run(f.ctx, { ticket, revision: "test" });
    if (result.decision !== "started" || !("attemptId" in result) || typeof result.attemptId !== "string")
      throw new Error(`Expected folder dispatch: ${JSON.stringify(result)}`);
    return result;
  };
  const a = await dispatch(first.id);
  expect(a.workspaceId).toBe("default");
  expect(f.sessions.get(supervisor)?.status).toBe("in_progress");
  f.sessions.get(a.sessionId)!.status = "completed";
  const b = await dispatch(second.id);
  expect(b.attemptId).not.toBe(a.attemptId);
  expect(b.workspaceId).toBe(a.workspaceId);
  expect(await autoBuildDispatches(f.ctx, supervisor).list()).toHaveLength(2);
  expect((await readAutoBuildOwnership(f.ctx, supervisor)).sessionIds).toEqual(
    new Set([supervisor, a.sessionId, b.sessionId]),
  );
  f.sessions.get(b.sessionId)!.status = "completed";
  const request = await requestReviewCommand.run(f.ctx, {
    ticket: first.id,
    attemptId: a.attemptId,
    sessionId: a.sessionId,
    title: "Choose the wording",
    instructions: "Choose the final wording.",
    request: {
      kind: "decision",
      questions: [{ id: "wording", label: "Wording", required: true, input: { kind: "text" } }],
    },
  });
  expect(request.context).toMatchObject({ attemptId: a.attemptId, workspaceId: a.workspaceId });
  await reviewCommand.run(f.ctx, {
    requestId: request.id,
    response: { answers: { wording: "Use the shorter version" } },
  });
  expect((await readAutoBuildResumptions(f.ctx)).get(first.id)?.attemptId).toBe(a.attemptId);
  expect(await resumeAutoBuildAttempt(f.ctx, first.id, async () => {})).toMatchObject({
    decision: "started",
    attemptId: a.attemptId,
  });
  const history = await readAttemptHistoryCommand.run(f.ctx, { attemptId: a.attemptId });
  expect(history.events.filter((event) => event.type === "implementation_resumed")).toHaveLength(2);
  expect(history.events.every((event) => event.attemptId === a.attemptId)).toBe(true);
  f.sessions.set("manual", sessionRecord({ id: "manual", title: "Unrelated work", status: "in_progress" }));
  const stopped: string[] = [];
  f.ctx.sessions.stop = async (id) => {
    stopped.push(id);
    f.sessions.get(id)!.status = "cancelled";
  };
  await pauseAutoBuildCommand.run(f.ctx, {});
  await stopAutoBuildCommand.run(f.ctx, {});
  expect(new Set(stopped)).toEqual(new Set([supervisor, a.sessionId, b.sessionId]));
  expect(f.sessions.get("manual")?.status).toBe("in_progress");
});
