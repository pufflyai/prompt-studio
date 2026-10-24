import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { putTicket, ticketsCollection } from "./ticket-context.fixture";
import { ticketRecords } from "./ticket-records";

import type { Ticket } from "./types";

const storedTicket: Ticket = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "# Ticket",
  statusId: "ready",
  tags: {},
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
  await putTicket(storage, { ...storedTicket, parallelizable: "no" } as Ticket);

  await cleanupLegacyTicketFields(storage);

  expect(await ticketsCollection(storage).get("ticket-1")).toEqual(storedTicket);
});

test("keeps an edit made after the tickets were listed", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, { ...storedTicket, parallelizable: "no" } as Ticket);
  const tickets = ticketRecords(storage);
  const list = tickets.list.bind(tickets);
  tickets.list = async () => {
    const listed = await list();
    await putTicket(storage, { ...storedTicket, title: "Edited", parallelizable: "no" } as Ticket);
    return listed;
  };

  await cleanupLegacyTicketFields({ ...storage, collection: () => tickets } as typeof storage);

  expect(await ticketsCollection(storage).get("ticket-1")).toEqual({ ...storedTicket, title: "Edited" });
});
