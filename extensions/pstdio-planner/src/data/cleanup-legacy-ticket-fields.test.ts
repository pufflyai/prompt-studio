import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { putTicket, ticketsCollection } from "./collections";
import type { StoredTicket } from "./types";

const storedTicket: StoredTicket = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "# Ticket",
  statusId: "ready",
  tagIds: [],
  attachments: [],
  parentId: null,
  dependsOn: [],
  blockedReason: null,
  userPrompt: null,
  draft: false,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-10-02T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
};

test("removes the old parallelizable field from stored tickets", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, { ...storedTicket, parallelizable: "no" } as StoredTicket);

  await cleanupLegacyTicketFields(storage);

  expect(await ticketsCollection(storage).get("ticket-1")).toEqual(storedTicket);
});

test("keeps an edit made after the tickets were listed", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, { ...storedTicket, parallelizable: "no" } as StoredTicket);
  const tickets = ticketsCollection(storage);
  const list = tickets.list.bind(tickets);
  tickets.list = async () => {
    const listed = await list();
    await putTicket(storage, { ...storedTicket, title: "Edited", parallelizable: "no" } as StoredTicket);
    return listed;
  };

  await cleanupLegacyTicketFields({ ...storage, collection: () => tickets } as typeof storage);

  expect(await ticketsCollection(storage).get("ticket-1")).toEqual({ ...storedTicket, title: "Edited" });
});
