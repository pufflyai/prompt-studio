import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { cleanupLegacyTicketFields } from "./cleanup-legacy-ticket-fields";
import { putTicket, ticketsCollection } from "./ticket-context.fixture";

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
  const query = storage.records.query.bind(storage.records);
  storage.records.query = async (input) => {
    const selected = await query(input);
    await putTicket(storage, { ...storedTicket, title: "Edited", content: "# Edited", parallelizable: "no" } as Ticket);
    return selected;
  };
  await cleanupLegacyTicketFields(storage);

  expect(await ticketsCollection(storage).get("ticket-1")).toEqual({
    ...storedTicket,
    title: "Edited",
    content: "# Edited",
  });
});
