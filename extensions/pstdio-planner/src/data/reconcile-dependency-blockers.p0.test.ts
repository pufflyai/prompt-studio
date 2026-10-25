import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { nextTicketsCommand } from "../commands/next-tickets";
import { updateTicketCommand } from "../commands/update-ticket";
import { plannerTicketsChanged } from "../events";
import { reconcileDependencyBlockers } from "./reconcile-dependency-blockers";
import { ticketsCollection } from "./ticket-context.fixture";

test("reconciles an existing dependency-only blocker after its prerequisite was already completed", async () => {
  const { ctx, ticket, storage } = await fixture();
  const parent = await ticket("Merged prerequisite");
  await ticketsCollection(storage).put(parent.id, { ...parent, statusId: "done" });
  const child = await ticket("Dependent contract", [parent.id]);
  await ticketsCollection(storage).put(child.id, {
    ...child,
    blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
  });
  const changes: unknown[] = [];
  ctx.events.emit = async (event, payload) => {
    changes.push({ event, payload });
    return { delivered: 0 };
  };
  expect(await reconcileDependencyBlockers(ctx)).toEqual([child.id]);
  expect(await ticketsCollection(storage).get(child.id)).toMatchObject({
    statusId: "ready",
    blockedReason: null,
    dependsOn: [parent.id],
  });
  expect((await nextTicketsCommand.run(ctx, {})).tickets.map(({ id }) => id)).toContain(child.id);
  expect(changes).toEqual([{ event: plannerTicketsChanged, payload: {} }]);
  expect(await reconcileDependencyBlockers(ctx)).toEqual([]);
  expect(changes).toHaveLength(1);
});

test("keeps a new independent blocker edited after reconciliation listed the tickets", async () => {
  const { ctx, ticket, storage } = await fixture();
  const parent = await ticket("Merged prerequisite");
  await ticketsCollection(storage).put(parent.id, { ...parent, statusId: "done" });
  const child = await ticket("Dependent contract", [parent.id]);
  const collection = ticketsCollection(storage);
  await collection.put(child.id, {
    ...child,
    blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
  });
  const list = collection.list.bind(collection);
  collection.list = async () => {
    const listed = await list();
    await collection.put(child.id, { ...child, title: "Edited", blockedReason: "Needs contract-owner approval" });
    return listed;
  };
  const context = {
    ...ctx,
    storage: {
      ...storage,
      collection: (name: string) => (name === "tickets" ? collection : storage.collection(name)) as never,
    },
  };
  expect(await reconcileDependencyBlockers(context)).toEqual([]);
  expect(await collection.get(child.id)).toMatchObject({
    title: "Edited",
    blockedReason: "Needs contract-owner approval",
  });
});

test("ticket updates keep dependency waiting in links and preserve independent blockers", async () => {
  const { ctx, ticket, storage } = await fixture();
  const parent = await ticket("Prerequisite");
  const child = await ticket("Dependent contract", [parent.id]);
  const updated = await updateTicketCommand.run(ctx, {
    id: child.id,
    blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
  });
  expect(updated).toMatchObject({ blockedReason: null, dependsOn: [parent.id] });
  expect((await ticketsCollection(storage).get(child.id))?.blockedReason).toBeNull();
  await updateTicketCommand.run(ctx, { id: child.id, blockedReason: "Needs credentials" });
  await updateTicketCommand.run(ctx, { id: parent.id, status: "Done" });
  await reconcileDependencyBlockers(ctx);
  expect((await ticketsCollection(storage).get(child.id))?.blockedReason).toBe("Needs credentials");
  await updateTicketCommand.run(ctx, { id: child.id, blockedReason: "" });
  expect(await ticketsCollection(storage).get(child.id)).toMatchObject({ blockedReason: null, dependsOn: [parent.id] });
});

test("clears a dependency-only blocker before its prerequisite is done and keeps the dependency link", async () => {
  const { ctx, ticket, storage } = await fixture();
  const parent = await ticket("Unfinished prerequisite");
  const child = await ticket("Dependent contract", [parent.id]);
  await ticketsCollection(storage).put(child.id, {
    ...child,
    blockedReason: `Complete ${parent.shorthand} before implementing this dependent contract.`,
  });
  expect(await reconcileDependencyBlockers(ctx)).toEqual([child.id]);
  expect(await ticketsCollection(storage).get(child.id)).toMatchObject({ blockedReason: null, dependsOn: [parent.id] });
  expect((await nextTicketsCommand.run(ctx, {})).waiting).toContainEqual(
    expect.objectContaining({ id: child.id, reason: "dependency-not-ready" }),
  );
});
