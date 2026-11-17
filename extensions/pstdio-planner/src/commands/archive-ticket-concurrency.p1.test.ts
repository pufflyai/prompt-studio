import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketIdOfRecord } from "../data/storage-reads.fixture";
import type { StoredTicket } from "../data/types";
import { queuedRun } from "./archive-context.fixture";
import { archiveTicketColumnAction, archiveTicketCommand } from "./archive-ticket";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

test("archiving one ticket changes only its archive fields after a concurrent edit", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { settings: { get: async () => false } } });
  const ticket = await createTicketCommand.run(ctx, { title: "Original" });
  const collection = storage.collection.bind(storage);
  let reads = 0;
  // Tickets are records since storage version 5. Finding the ticket is the first read; another edit
  // lands as the archive reads the ticket it saves.
  const read = storage.records.read.bind(storage.records);
  storage.records.read = async (recordId, ...rest) => {
    const id = ticketIdOfRecord(recordId);
    if (id && ++reads === 2) {
      const current = await collection<StoredTicket>("tickets").get(id);
      await collection<StoredTicket>("tickets").put(id, {
        ...current!,
        content: "# Concurrent title\n\nNew body",
        title: "Concurrent title",
        statusId: "ready",
      });
    }
    return read(recordId, ...rest);
  };
  await archiveTicketCommand.run({ ...ctx, resource: { type: "ticket", id: ticket.id } }, {});
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(await collection("tickets").get(ticket.id)).toMatchObject({
    archived: true,
    statusId: "ready",
    content: "# Concurrent title\n\nNew body",
  });
});

test("bulk archival retries a stale page and preserves concurrent fields and status changes", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: { settings: { get: async () => false }, automation: { enqueue: async () => queuedRun() } },
  });
  const tickets: { id: string }[] = [];
  for (let i = 0; i < 3; i++)
    tickets.push(await createTicketCommand.run(ctx, { title: `Ticket ${i}`, statusId: "done" }));
  const commit = storage.records.commitIfCurrent;
  let changed = false;
  storage.records.commitIfCurrent = async (group) => {
    if (!changed) {
      changed = true;
      const records = storage.collection<StoredTicket>("tickets");
      const a = (await records.get(tickets[0]!.id))!,
        b = (await records.get(tickets[1]!.id))!;
      await records.put(a.id, { ...a, statusId: "ready" });
      await records.put(b.id, {
        ...b,
        content: "Concurrent body",
        files: [{ id: "file", name: "kept.md", blobId: "blob", createdAt: "2026-11-14", updatedAt: "2026-11-14" }],
      });
    }
    return commit(group);
  };
  expect(await archiveTicketColumnAction(ctx, { columnId: "done", actionId: "archive_all" })).toEqual({
    archivedCount: 2,
  });
  expect(await storage.collection("tickets").get(tickets[0]!.id)).toMatchObject({ archived: false, statusId: "ready" });
  expect(await storage.collection("tickets").get(tickets[1]!.id)).toMatchObject({
    archived: true,
    content: "Concurrent body",
    files: [expect.objectContaining({ id: "file" })],
  });
});
