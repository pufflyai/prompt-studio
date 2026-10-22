import { expect, test } from "bun:test";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { putTicket } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { autoBuildScopeCommand } from "./auto-build-scope";
import { readNextTickets } from "./next-tickets";

test("saving scope preserves the supervisor and returns fresh work from that scope", async () => {
  const { ctx, ticket } = await fixture();
  const parent = await ticket("Requested parent");
  const child = await ticket("Requested task");
  await putTicket(ctx.storage, { ...child, parentId: parent.id });
  await ticket("Other task");
  await saveAutoBuildSupervisor(ctx, { sessionId: "supervisor" });
  const result = await autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{ parent: parent.id }] });
  expect(result.tickets.map(({ id }) => id)).toEqual([child.id]);
  expect(await readAutoBuildSupervisor(ctx)).toMatchObject({
    sessionId: "supervisor",
    scope: { revision: "test", queries: [{ parent: parent.id }] },
  });
  const work = await readNextTickets(ctx, await readAutoBuildMode(ctx));
  expect((await readAutoBuildSupervisor(ctx)).lastWake).toBe(work.snapshot);
});

test("scope snapshots ignore unrelated edits and include prerequisites outside the scope", async () => {
  const { ctx, ticket } = await fixture();
  const parent = await ticket("Requested parent");
  const prerequisite = await ticket("Shared prerequisite");
  const child = await ticket("Requested task", [prerequisite.id]);
  await putTicket(ctx.storage, { ...child, parentId: parent.id });
  const other = await ticket("Unrelated task");
  await autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{ parent: parent.id }] });
  const mode = await readAutoBuildMode(ctx);
  const before = await readNextTickets(ctx, mode);
  await putTicket(ctx.storage, { ...other, title: "Unrelated edit" });
  expect((await readNextTickets(ctx, mode)).snapshot).toBe(before.snapshot);
  await putTicket(ctx.storage, { ...prerequisite, blockedReason: "Needs credentials" });
  expect((await readNextTickets(ctx, mode)).snapshot).not.toBe(before.snapshot);
});

test("invalid scope and stale mode revisions leave the saved work scope intact", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Ready");
  await autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{}] });
  const before = await readAutoBuildSupervisor(ctx);
  await expect(autoBuildScopeCommand.run(ctx, { revision: "old", queries: [{}] })).rejects.toThrow("stopped");
  await expect(autoBuildScopeCommand.run(ctx, { revision: "test", queries: [] })).rejects.toThrow("work query");
  await expect(autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{ track: "Unknown" }] })).rejects.toThrow(
    "Unknown track",
  );
  expect(await readAutoBuildSupervisor(ctx)).toEqual(before);
});

test("a mode change during scope resolution cannot save a scope for the old prompt", async () => {
  const { ctx, ticket, storage } = await fixture();
  await ticket("Ready");
  ctx.process.run = async () => {
    const mode = await readAutoBuildMode(ctx);
    await storage.set("auto-build", { ...mode, enabled: false, revision: "stopped" });
    return { exitCode: 0, stdout: "main-sha\n", stderr: "" };
  };
  await expect(autoBuildScopeCommand.run(ctx, { revision: "test", queries: [{}] })).rejects.toThrow("stopped");
  expect(await readAutoBuildSupervisor(ctx)).toEqual({ sessionId: "fixture-supervisor" });
});
