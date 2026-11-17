import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketIdOfRecord } from "../data/storage-reads.fixture";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { requestReviewCommand, reviewCommand } from "./review-requests";

test("answering a request preserves ticket edits that race with its reads", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () => ({ type: "session", id: "chat", title: "Chat", status: "in_progress" }),
      } as never,
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Original" });
  const request = await requestReviewCommand.run(ctx, {
    ticket: ticket.id,
    title: "Check preview",
    instructions: "Confirm the preview.",
    request: { kind: "task" },
  } as never);
  const collection = ticketsCollection(storage);
  const get = collection.get.bind(collection);
  let latest = (await get(ticket.id))!;
  let edits = 0;
  // Tickets are records since storage version 5: another edit lands right after each ticket read.
  const racing: typeof storage = {
    ...storage,
    records: {
      ...storage.records,
      async read(recordId, ...rest) {
        const snapshot = await storage.records.read(recordId, ...rest);
        const id = ticketIdOfRecord(recordId);
        const current = id && (await get(id));
        if (!current) return snapshot;
        const title = `Edit ${++edits}`;
        latest = {
          ...current,
          title,
          content: `${title}\n\nKeep the new body`,
          statusId: "ready",
          tags: { labels: ["other"] },
        };
        await collection.put(current.id, latest);
        return snapshot;
      },
    },
  };
  await reviewCommand.run({ ...ctx, storage: racing }, { requestId: request.id, response: { confirmed: true } });
  expect(edits).toBeGreaterThan(0);
  expect(await get(ticket.id)).toEqual(latest);
});
