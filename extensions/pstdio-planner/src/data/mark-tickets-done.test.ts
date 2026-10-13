import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { statusesCollection, ticketsCollection } from "./collections";
import { markTicketsDone } from "./mark-tickets-done";

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
    canDragIn: true,
    canDragOut: true,
    isDefault: false,
    columnActions: [],
  });
  await markTicketsDone(ctx, [ticket.id]);
  expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("custom-finished");
});
