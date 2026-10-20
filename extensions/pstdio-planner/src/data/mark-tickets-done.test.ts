
import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { fixture } from "../commands/auto-build.fixture";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { statusesCollection } from "./collections";
import { markTicketsDone } from "./mark-tickets-done";
import { ticketsCollection } from "./ticket-context.fixture";

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

test("merge destination follows explicit IDs after every status is renamed", async () => {
  const storage = createMemoryStorage();
  const settings = {
    "tickets.markDoneOnMerge": true,
    "workflow.statuses": {
      completedStatusIds: ["custom-finished"],
      blockedStatusIds: [],
      activeStatusIds: [],
      mergeTargetStatusId: "custom-finished",
    },
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      settings: {
        all: async () => settings,
        get: async (key: string) => settings[key as keyof typeof settings],
      } as never,
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Merge me" });
  await statusesCollection(storage).put("custom-finished", {
    id: "custom-finished",
    name: "Shipped",
    color: "green",
    sortOrder: 20,
    canCreate: false,
    isDefault: false,
    columnActions: [],
  });
  await markTicketsDone(ctx, [ticket.id]);
  expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("custom-finished");
});
