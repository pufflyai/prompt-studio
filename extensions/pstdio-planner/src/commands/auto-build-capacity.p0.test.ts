import { expect, test } from "bun:test";
import { listAttempts } from "../data/attempt-storage";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { autoBuildCommand } from "./auto-build";
import { fixture } from "./auto-build.fixture";
import { hasDeviceWorkspaceCapacity } from "./auto-build-capacity";
import { autoBuildDispatchCommand } from "./auto-build-dispatch";
import { supervisorFixture } from "./auto-build-supervisor.fixture";
import { readNextTickets } from "./next-tickets";
import { runAttemptCommand } from "./run-attempt";
import { sessionQuery } from "./session-query.fixture";
import { sessionRecord } from "./session-record.fixture";

const dispatch = (ctx: Awaited<ReturnType<typeof fixture>>["ctx"], ticket: string, workspaceId?: string) =>
  autoBuildDispatchCommand.run(ctx, { ticket, revision: "test", workspaceId });

const capacity = (activeCount: number, limit: number | null) => ({
  deviceId: "local-device",
  deviceName: "Laptop",
  activeCount,
  limit,
});

test("a device filled by other projects skips attempts and starts after a slot frees without changing Planner settings", async () => {
  const { ctx, storage, ticket } = await fixture(3);
  const task = await ticket("Ready work");
  const mode = await readAutoBuildMode(ctx);
  const settings = await ctx.settings.all();
  let active = 1;
  ctx.workspaces.getCapacity = async () => capacity(active, 1);
  const create = ctx.workspaces.create;
  let created = 0;
  ctx.workspaces.create = async (input) => {
    created++;
    return create(input);
  };
  const full = await readNextTickets(ctx, mode);
  expect(full.capacity).toEqual({ running: 0, limit: 3 });
  expect(full.tickets).toContainEqual(expect.objectContaining({ id: task.id }));
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "device-capacity-full" });
  expect(created).toBe(0);
  expect(await listAttempts(storage)).toHaveLength(0);
  active = 0;
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "started" });
  expect(created).toBe(1);
  expect(await listAttempts(storage)).toHaveLength(1);
  expect(await readAutoBuildMode(ctx)).toEqual(mode);
  expect(await ctx.settings.all()).toEqual(settings);
});

test("a device becoming full while a workspace is created cannot queue an implementation", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Ready work");
  let active = 0;
  ctx.workspaces.getCapacity = async () => capacity(active, 1);
  const create = ctx.workspaces.create;
  ctx.workspaces.create = async (input) => {
    const workspace = await create(input);
    active = 1;
    return workspace;
  };
  let started = 0;
  ctx.sessions.create = async () => {
    started++;
    throw new Error("Full device must not start or queue this session");
  };
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "device-capacity-full" });
  expect(started).toBe(0);
  expect(await listAttempts(storage)).toHaveLength(0);
});

test("capacity is rechecked after the implementation prompt is prepared", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Ready work");
  let active = 0;
  ctx.workspaces.getCapacity = async () => capacity(active, 1);
  const read = ctx.packageFiles.readText;
  ctx.packageFiles.readText = async (path) => {
    const text = await read(path);
    active = 1;
    return text;
  };
  let starts = 0;
  ctx.sessions.create = async () => {
    starts++;
    throw new Error("Must skip the full device");
  };
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "device-capacity-full" });
  expect(starts).toBe(0);
  expect(await listAttempts(storage)).toHaveLength(0);
});

for (const status of ["in_progress", "awaiting_input", "queued", "completed"] as const) {
  test(`existing workspace slot sharing follows host activity for ${status}`, async () => {
    const { ctx } = await fixture();
    ctx.workspaces.getCapacity = async () => capacity(1, 1);
    ctx.sessions.query = sessionQuery(
      async () => [],
      async () => [{ id: "existing", title: "Work", status }],
    );
    expect(await hasDeviceWorkspaceCapacity(ctx, "existing-workspace")).toBe(
      status === "in_progress" || status === "awaiting_input",
    );
  });
}

test("an unlimited device still obeys Planner's configured ticket capacity", async () => {
  const { ctx, ticket } = await fixture(0);
  const task = await ticket("Ready work");
  ctx.workspaces.getCapacity = async () => capacity(99, null);
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "capacity-full" });
});

test("device capacity checks leave the existing supervisor lifecycle and ticket discovery unchanged", async () => {
  const { ctx, ticket, sessions, prompts } = await supervisorFixture(3);
  const task = await ticket("Ready work");
  let active = 1;
  ctx.workspaces.getCapacity = async () => capacity(active, 1);
  const mode = await readAutoBuildMode(ctx);
  await autoBuildCommand.run(ctx, {});
  const owner = prompts[0]!.sessionId;
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "device-capacity-full" });
  expect(prompts).toHaveLength(1);
  active = 0;
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "started" });
  expect(sessions.has(owner)).toBe(true);
  expect(await readAutoBuildMode(ctx)).toEqual(mode);
});

test("a stopped implementation waits on a full device and resumes its same owner after capacity frees", async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("Continue work");
  const original = await runAttemptCommand.run(ctx, { ticket: task.id });
  ctx.sessions.get = async (id) => sessionRecord({ id, title: "Owner", status: "completed" });
  const followups: string[] = [];
  ctx.sessions.followup = async ({ sessionId }) => {
    followups.push(sessionId);
  };
  let active = 1;
  ctx.workspaces.getCapacity = async () => capacity(active, 1);
  expect(await dispatch(ctx, task.id)).toMatchObject({ decision: "wait", reason: "device-capacity-full" });
  expect(followups).toEqual([]);
  active = 0;
  expect(await dispatch(ctx, task.id)).toMatchObject({
    decision: "started",
    workspaceId: original.workspace.id,
    sessionId: original.session.id,
  });
  expect(followups).toEqual([original.session.id]);
  expect(await listAttempts(storage)).toHaveLength(1);
});

test("another device's active personal history cannot share a local slot", async () => {
  const { ctx } = await fixture();
  ctx.workspaces.getCapacity = async () => capacity(1, 1);
  ctx.sessions.query = sessionQuery(async () => [
    {
      id: "remote",
      title: "Remote work",
      status: "in_progress",
      device: { ownerId: "owner", id: "other-device", name: "Desktop" },
    },
  ]);
  expect(await hasDeviceWorkspaceCapacity(ctx, "existing-workspace")).toBe(false);
});

test("local active workspace sharing can be found after a page of remote personal history", async () => {
  const { ctx } = await fixture();
  ctx.workspaces.getCapacity = async () => capacity(1, 1);
  const remote = sessionRecord({
    id: "remote",
    title: "Remote work",
    status: "in_progress",
    device: { ownerId: "owner", id: "other-device", name: "Desktop" },
  });
  const local = sessionRecord({ id: "local", title: "Local work", status: "awaiting_input" });
  const cursors: (string | undefined)[] = [];
  ctx.sessions.query = async (input) => {
    cursors.push(input?.cursor);
    return input?.cursor ? { items: [local], nextCursor: null } : { items: [remote], nextCursor: "local-page" };
  };
  expect(await hasDeviceWorkspaceCapacity(ctx, "existing-workspace")).toBe(true);
  expect(cursors).toEqual([undefined, "local-page"]);
});
