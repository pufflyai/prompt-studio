import { describe, expect, test } from "bun:test";
import extension from "./extension";
import { putTicket, statusesCollection, ticketsCollection } from "./src/data/collections";
import { createMemoryStorage } from "./src/data/memory-storage";
import { seedDefaultStatuses } from "./src/data/seed";
import type { StoredTicket } from "./src/data/types";

const makeTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "Ticket",
  statusId: "default-todo",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("pstdio-core-tickets", () => {
  test("session.started marks the ticket as in progress", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await putTicket(storage, makeTicket({ shorthand: "PS-1" }));

    await extension.hooks?.markTicketInProgress?.handler({ storage } as never, {
      projectId: "project-1",
      sessionId: "session-1",
      ticket: { id: ticket.id, shorthand: ticket.shorthand },
    });

    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      statusId: "default-in-progress",
    });
  });

  test("session.started resolves the ticket from workspace shorthand", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await putTicket(storage, makeTicket({ shorthand: "PS-2" }));

    await extension.hooks?.markTicketInProgress?.handler({ storage } as never, {
      projectId: "project-1",
      sessionId: "session-1",
      workspace: { id: "workspace-1", ticket_shorthand: ticket.shorthand },
    });

    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      statusId: "default-in-progress",
    });
  });

  test("session.started prefers extension-owned shorthand over legacy ticket id", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await putTicket(storage, makeTicket({ shorthand: "PS-3" }));

    await extension.hooks?.markTicketInProgress?.handler({ storage } as never, {
      projectId: "project-1",
      sessionId: "session-1",
      ticket: { id: "legacy-ticket-id", shorthand: ticket.shorthand },
    });

    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      statusId: "default-in-progress",
    });
  });

  test("session.started leaves the ticket unchanged when in progress status was removed", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await statusesCollection(storage).delete("default-in-progress");
    const ticket = await putTicket(storage, makeTicket({ shorthand: "PS-4" }));

    await extension.hooks?.markTicketInProgress?.handler({ storage } as never, {
      projectId: "project-1",
      sessionId: "session-1",
      ticket: { id: ticket.id, shorthand: ticket.shorthand },
    });

    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      statusId: "default-todo",
    });
  });
});
