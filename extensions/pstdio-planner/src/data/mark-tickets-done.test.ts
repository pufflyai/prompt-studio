import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { ticketsCollection } from "./collections";
import { markTicketsDone } from "./mark-tickets-done";

test("completion clears only dependency blocker text backed by the completed dependency links", async () => {
  const { ctx, ticket, storage } = await fixture();
  const prerequisite = await ticket("Prerequisite");
  const child = await ticket("Dependent contract", [prerequisite.id]);
  const human = await ticket("Needs approval", [prerequisite.id]);
  const unlinked = await ticket("Independent blocker");
  const collection = ticketsCollection(storage);
  const reason = `Complete ${prerequisite.shorthand} before implementing this dependent contract.`;
  await collection.put(child.id, { ...child, blockedReason: reason });
  await collection.put(human.id, { ...human, blockedReason: `${reason} Obtain contract-owner approval.` });
  await collection.put(unlinked.id, { ...unlinked, blockedReason: reason });
  await markTicketsDone(ctx, [prerequisite.id]);
  expect(await collection.get(child.id)).toMatchObject({ blockedReason: null, dependsOn: [prerequisite.id] });
  expect((await collection.get(human.id))?.blockedReason).toBe(`${reason} Obtain contract-owner approval.`);
  expect((await collection.get(unlinked.id))?.blockedReason).toBe(reason);
});

test("all named prerequisites must finish before persistent dependency blocker cleanup", async () => {
  const { ctx, ticket, storage } = await fixture();
  const first = await ticket("First prerequisite");
  const second = await ticket("Second prerequisite");
  const child = await ticket("Dependent contract", [first.id, second.id]);
  const reason = `Complete ${first.shorthand} and ${second.shorthand} before implementing this dependent contract.`;
  await ticketsCollection(storage).put(child.id, { ...child, blockedReason: reason });
  await markTicketsDone(ctx, [first.id]);
  expect((await ticketsCollection(storage).get(child.id))?.blockedReason).toBe(reason);
  await markTicketsDone(ctx, [second.id]);
  expect(await ticketsCollection(storage).get(child.id)).toMatchObject({
    blockedReason: null,
    dependsOn: [first.id, second.id],
  });
});
