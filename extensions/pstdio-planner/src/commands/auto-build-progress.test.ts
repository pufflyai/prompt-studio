import { expect, test } from "bun:test";
import { putAttempt } from "../data/attempt-storage";
import type { AttemptRecord } from "../data/attempt-types";
import { autoBuildDispatches } from "../data/auto-build-dispatches";
import { saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { ticketsCollection } from "../data/collections";
import { withWriteGuard } from "../data/write-guard";
import { checkAutoBuildCommand } from "../hooks/auto-build";
import { fixture } from "./auto-build.fixture";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { sessionRecord } from "./session-record.fixture";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function monitorFixture() {
  const context = await fixture();
  const { ctx, ticket } = context;
  await saveAutoBuildSupervisor(ctx, { sessionId: "supervisor" });
  const task = await ticket("Owned work");
  const dispatched = await autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" });
  if (dispatched.decision !== "started") throw new Error("Expected a dispatched attempt");
  await autoBuildDispatches(ctx, "supervisor").put(dispatched.workspaceId, {
    workspaceId: dispatched.workspaceId,
    dispatchedAt: ago(8),
  });
  const supervisor = sessionRecord({
    id: "supervisor",
    title: "Supervisor",
    status: "completed",
    lastRequestStarted: ago(10),
  });
  const worker = sessionRecord({
    id: dispatched.sessionId,
    title: "Worker",
    status: "completed",
    updatedAt: ago(1),
    lastRequestStarted: ago(5),
  });
  const followups: string[] = [];
  const fetched: string[] = [];
  const collection = ctx.storage.collection.bind(ctx.storage);
  ctx.storage.collection = <T>(name: string) => {
    const source = collection<T>(name);
    return {
      ...source,
      list: async () => {
        throw new Error(`Scheduled wake must not list project collection ${name}`);
      },
      get: async (id) => {
        if (name === "tickets") fetched.push(id);
        return source.get(id);
      },
    };
  };
  ctx.sessions.get = async (id) => {
    if (id === supervisor.id) return supervisor;
    if (id === worker.id) return worker;
    return null;
  };
  ctx.sessions.query = async () => {
    throw new Error("Scheduled wake must not query project session history");
  };
  ctx.workspaces.list = async () => {
    throw new Error("Scheduled wake must not list project workspaces");
  };
  ctx.automation.list = async () => {
    throw new Error("Scheduled wake must not list project automations");
  };
  ctx.automation.enqueue = async () => {
    throw new Error("Scheduled wake must not enqueue discovery");
  };
  ctx.events.emit = async () => {
    throw new Error("Scheduled wake must not trigger ticket-change hooks");
  };
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
    supervisor.status = "in_progress";
    supervisor.lastRequestStarted = new Date().toISOString();
  };
  return { ...context, task, dispatched, supervisor, worker, followups, fetched, collection };
}

test.each([
  undefined,
  { enabled: false },
  { enabled: true, prompt: "" },
])("inactive Auto Build returns before reading project collections (%j)", async (mode) => {
  const { ctx } = await fixture();
  if (mode) await ctx.storage.set("auto-build", mode);
  else await ctx.storage.delete("auto-build");
  ctx.storage.collection = () => {
    throw new Error("Inactive Auto Build must not read collections");
  };
  ctx.sessions.get = async () => {
    throw new Error("Inactive Auto Build must not read sessions");
  };
  await checkAutoBuildCommand.run(ctx, {});
});

test("scheduled wakes read only the current supervisor's dispatched work and never enqueue discovery", async () => {
  const { ctx, task, fetched, followups } = await monitorFixture();
  await checkAutoBuildCommand.run(ctx, {});
  expect(fetched).toEqual([task.id]);
  expect(followups).toEqual(["supervisor"]);
});

test("an active supervisor returns before reading dispatched work", async () => {
  const { ctx, supervisor, fetched, followups } = await monitorFixture();
  supervisor.status = "in_progress";
  await checkAutoBuildCommand.run(ctx, {});
  expect(fetched).toEqual([]);
  expect(followups).toEqual([]);
});

test("unchanged work does not prompt a sleeping supervisor", async () => {
  const { ctx, supervisor, followups } = await monitorFixture();
  supervisor.lastRequestStarted = new Date(Date.now() + 1000).toISOString();
  await checkAutoBuildCommand.run(ctx, {});
  expect(followups).toEqual([]);
});

test("a restarted run does not inspect the previous supervisor's work", async () => {
  const { ctx, fetched, followups } = await monitorFixture();
  await ctx.storage.set("auto-build-supervisor", { sessionId: "new-supervisor" });
  ctx.sessions.get = async (id) => sessionRecord({ id, title: "New supervisor", status: "completed" });
  await checkAutoBuildCommand.run(ctx, {});
  expect(fetched).toEqual([]);
  expect(followups).toEqual([]);
});

test("stalled owned work gets at most one reminder per hour", async () => {
  const { ctx, task, dispatched, collection, supervisor, worker, followups } = await monitorFixture();
  const attempt = await collection<AttemptRecord>("planner-attempts").get(dispatched.workspaceId);
  await putAttempt(ctx.storage, { ...attempt!, updatedAt: ago(120) });
  await ticketsCollection(ctx.storage).put(task.id, { ...task, updatedAt: ago(120) });
  supervisor.lastRequestStarted = ago(61);
  worker.updatedAt = ago(120);
  worker.lastRequestStarted = ago(120);
  worker.status = "in_progress";
  await autoBuildDispatches(ctx, "supervisor").put(dispatched.workspaceId, {
    workspaceId: dispatched.workspaceId,
    dispatchedAt: ago(120),
  });
  await checkAutoBuildCommand.run(ctx, {});
  supervisor.status = "completed";
  await checkAutoBuildCommand.run(ctx, {});
  expect(followups).toEqual(["supervisor"]);
});

test("dispatch ownership survives a concurrent supervisor wake", async () => {
  const { ctx, ticket } = await fixture();
  await saveAutoBuildSupervisor(ctx, { sessionId: "supervisor" });
  const task = await ticket("Work dispatched during wake");
  const result = await withWriteGuard(ctx, "auto-build-supervisor", async () =>
    autoBuildDispatchCommand.run(ctx, { ticket: task.id, revision: "test" }),
  );
  expect(result.decision).toBe("started");
  if (result.decision !== "started") throw new Error("Expected a dispatched attempt");
  expect(await autoBuildDispatches(ctx, "supervisor").list()).toEqual([
    { workspaceId: result.workspaceId, dispatchedAt: expect.any(String) },
  ]);
});

test("stopping during a scheduled read prevents the followup", async () => {
  const { ctx, supervisor, followups } = await monitorFixture();
  const readSession = ctx.sessions.get;
  ctx.sessions.get = async (id) => {
    if (id === supervisor.id) await ctx.storage.set("auto-build", { enabled: false });
    return readSession(id);
  };
  await checkAutoBuildCommand.run(ctx, {});
  expect(followups).toEqual([]);
});

test("the supervisor's own dispatch does not wake it again", async () => {
  const { ctx, dispatched, followups, worker } = await monitorFixture();
  worker.updatedAt = ago(1);
  await autoBuildDispatches(ctx, "supervisor").put(dispatched.workspaceId, {
    workspaceId: dispatched.workspaceId,
    dispatchedAt: new Date().toISOString(),
  });
  await checkAutoBuildCommand.run(ctx, {});
  expect(followups).toEqual([]);
});

test("failed scheduled followups pause Auto Build", async () => {
  const { ctx } = await monitorFixture();
  ctx.events.emit = async () => ({ delivered: 0 });
  ctx.sessions.followup = async () => {
    throw new Error("Agent unavailable");
  };
  await expect(checkAutoBuildCommand.run(ctx, {})).rejects.toThrow("Agent unavailable");
  expect(await ctx.storage.get("auto-build")).toMatchObject({ enabled: false });
});

test("a failed supervisor can resume before it has dispatched any work", async () => {
  const { ctx, supervisor, followups } = await monitorFixture();
  await autoBuildDispatches(ctx, supervisor.id).delete(
    (await autoBuildDispatches(ctx, supervisor.id).list())[0]!.workspaceId,
  );
  supervisor.status = "failed";
  await checkAutoBuildCommand.run(ctx, {});
  expect(followups).toEqual(["supervisor"]);
});

test("a supervisor resumed by another caller does not pause Auto Build", async () => {
  const { ctx, supervisor } = await monitorFixture();
  ctx.sessions.followup = async () => {
    supervisor.status = "in_progress";
    supervisor.lastRequestStarted = new Date().toISOString();
    throw new Error("Session run changed");
  };
  await checkAutoBuildCommand.run(ctx, {});
  expect(await ctx.storage.get("auto-build")).toMatchObject({ enabled: true });
});

test("a supervisor startup failure pauses Auto Build after the run state changes", async () => {
  const { ctx, supervisor } = await monitorFixture();
  ctx.events.emit = async () => ({ delivered: 0 });
  ctx.sessions.followup = async () => {
    supervisor.status = "failed";
    supervisor.lastRequestStarted = new Date().toISOString();
    supervisor.lastRequestEnded = new Date().toISOString();
    throw new Error("Agent startup failed");
  };
  await expect(checkAutoBuildCommand.run(ctx, {})).rejects.toThrow("Agent startup failed");
  expect(await ctx.storage.get("auto-build")).toMatchObject({ enabled: false });
});
