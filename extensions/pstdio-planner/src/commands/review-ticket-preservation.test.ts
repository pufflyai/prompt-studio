import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { TICKETS_COLLECTION } from "../data/collections";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { requestHumanCommand, reviewCommand } from "./review-requests";

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
  const request = await requestHumanCommand.run(ctx, {
    ticket: ticket.id,
    title: "Check preview",
    instructions: "Confirm the preview.",
    request: { kind: "task" },
  } as never);
  const collection = ticketsCollection(storage);
  const get = collection.get.bind(collection);
  let latest = (await get(ticket.id))!;
  let edits = 0;
  collection.get = async (id) => {
    const snapshot = await get(id);
    if (!snapshot) return snapshot;
    latest = {
      ...snapshot,
      title: `Edit ${++edits}`,
      content: "Keep the new body",
      statusId: "ready",
      tags: { labels: ["other"] },
    };
    await collection.put(id, latest);
    return snapshot;
  };
  const racing = {
    ...storage,
    collection: (name: string) => (name === TICKETS_COLLECTION ? collection : storage.collection(name)),
  } as typeof storage;
  await reviewCommand.run({ ...ctx, storage: racing }, { requestId: request.id, response: { confirmed: true } });
  expect(edits).toBeGreaterThan(0);
  expect(await get(ticket.id)).toEqual(latest);
});
