import { expect, test } from "bun:test";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { getReviewRequestSession } from "../data/review-request-session";
import { withWriteGuard } from "../data/write-guard";
import { autoBuildCommand } from "./auto-build";
import { pauseAutoBuildCommand } from "./auto-build-lifecycle";
import { stopAutoBuildCommand } from "./auto-build-stop";
import { supervisorFixture } from "./auto-build-supervisor.fixture";
import { requestHumanCommand } from "./review-requests";
import { runAttemptCommand } from "./run-attempt";
import { sessionRecord } from "./session-record.fixture";

const fixture = async () => {
  const result = await supervisorFixture();
  const task = await result.ticket("Build shared tool");
  await autoBuildCommand.run(result.ctx, {});
  const owner = await readAutoBuildSupervisor(result.ctx);
  const started = await runAttemptCommand.run(result.ctx, { ticket: task.id });
  await autoBuildDispatches(result.ctx, owner.sessionId!).put(started.variant.workspaceId, {
    workspaceId: started.variant.workspaceId,
    dispatchedAt: new Date().toISOString(),
  });
  const stopped: string[] = [];
  // The fixture emulates the host's acknowledged cancellation without stopping a real agent.
  Object.assign(result.ctx.sessions, {
    stop: async (id: string) => {
      stopped.push(id);
      const session = result.sessions.get(id);
      if (session) session.status = "cancelled";
    },
  });
  await pauseAutoBuildCommand.run(result.ctx, {});
  return { ...result, owner, started, stopped };
};

test("stop cancels linked supervisor and implementation sessions and leaves manual sessions alone", async () => {
  const { ctx, sessions, owner, started, stopped } = await fixture();
  sessions.set("manual", sessionRecord({ id: "manual", title: "Unrelated ticket agent", status: "in_progress" }));
  await stopAutoBuildCommand.run(ctx, {});
  expect(new Set(stopped)).toEqual(new Set([owner.sessionId!, started.session.id]));
  expect(sessions.get("manual")?.status).toBe("in_progress");
  expect(await readAutoBuildMode(ctx)).toMatchObject({ state: "stopped", enabled: false });
});

test("stop waits for in-flight dispatch records before enumerating linked sessions", async () => {
  const { ctx, owner, stopped } = await fixture();
  const finish = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  const launch = withWriteGuard(ctx, "attempt-launch", async () => {
    entered.resolve();
    await finish.promise;
    const task = await (await import("./create-ticket")).createTicketCommand.run(ctx, {
      title: "Late launch",
      statusId: "ready",
    });
    const started = await (await import("./run-attempt")).startAttempt(ctx, { ticket: task.id });
    await autoBuildDispatches(ctx, owner.sessionId!).put(started.workspace.id, {
      workspaceId: started.workspace.id,
      dispatchedAt: new Date().toISOString(),
    });
    return started.session.id;
  });
  await entered.promise;
  const stopping = stopAutoBuildCommand.run(ctx, {});
  expect(stopped).toEqual([]);
  finish.resolve();
  const id = await launch;
  await stopping;
  expect(stopped).toContain(id);
});

test("a failed cancellation keeps ownership paused for a safe retry", async () => {
  const { ctx, owner, stopped } = await fixture();
  const stop = (ctx.sessions as typeof ctx.sessions & { stop: (id: string) => Promise<void> }).stop;
  Object.assign(ctx.sessions, {
    stop: async (id: string) => {
      if (id !== owner.sessionId) throw new Error("Agent did not acknowledge stop");
      await stop(id);
    },
  });
  await expect(stopAutoBuildCommand.run(ctx, {})).rejects.toThrow("acknowledge");
  expect(await readAutoBuildMode(ctx)).toMatchObject({ state: "paused" });
  expect((await readAutoBuildSupervisor(ctx)).sessionId).toBe(owner.sessionId);
  Object.assign(ctx.sessions, { stop });
  await stopAutoBuildCommand.run(ctx, {});
  expect(stopped.length).toBeGreaterThan(1);
  expect(await readAutoBuildMode(ctx)).toMatchObject({ state: "stopped" });
});

test("stop includes supervisor-linked request chats before the first dispatch", async () => {
  const { ctx, ticket, sessions } = await supervisorFixture();
  const task = await ticket("Choose the tool");
  await autoBuildCommand.run(ctx, {});
  const owner = (await readAutoBuildSupervisor(ctx)).sessionId!;
  const request = await requestHumanCommand.run(ctx, {
    ticket: task.id,
    title: "Choose scope",
    instructions: "Pick a tool",
    request: { kind: "task" },
    sessionId: owner,
  });
  const chat = await getReviewRequestSession(ctx, request.id);
  const stopped: string[] = [];
  Object.assign(ctx.sessions, {
    stop: async (id: string) => {
      stopped.push(id);
      sessions.get(id)!.status = "cancelled";
    },
  });
  await pauseAutoBuildCommand.run(ctx, {});
  await stopAutoBuildCommand.run(ctx, {});
  expect(stopped).toContain(chat.id);
  expect(sessions.get(chat.id)?.status).toBe("cancelled");
});

test("a removed supervisor keeps its worker ledger available for Stop", async () => {
  const { ctx, owner, sessions, stopped, started, storage } = await fixture();
  sessions.delete(owner.sessionId!);
  const { saveAutoBuildMode } = await import("../data/auto-build-mode");
  await saveAutoBuildMode(ctx, { ...(await readAutoBuildMode(ctx)), state: "running", enabled: true });
  await expect(autoBuildCommand.run(ctx, {})).rejects.toThrow("supervisor was removed");
  expect(await storage.get("auto-build-supervisor")).toMatchObject({ sessionId: owner.sessionId });
  await stopAutoBuildCommand.run(ctx, {});
  expect(stopped).not.toContain(owner.sessionId!);
  expect(stopped).toContain(started.session.id);
  expect(await readAutoBuildMode(ctx)).toMatchObject({ state: "stopped" });
});

test("dispatch waits for a recorded run owner so Stop cannot lose its workers", async () => {
  const { ctx, storage, ticket, sessions } = await supervisorFixture();
  const task = await ticket("Build the tool");
  await storage.delete("auto-build-supervisor");
  const { autoBuildDispatchCommand } = await import("./auto-build-dispatch");
  expect(await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" })).toMatchObject({
    decision: "wait",
    reason: "supervisor-not-ready",
  });
  expect(sessions.size).toBe(0);
});
