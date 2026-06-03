import { describe, expect, test } from "bun:test";
import { putTicket, ticketsCollection } from "./collections";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "./file-operations";
import { createMemoryStorage } from "./memory-storage";
import type { StoredTicket } from "./types";

const ticket = (overrides: Partial<StoredTicket> = {}): StoredTicket => ({
  id: "ticket-1",
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("ticket file operations", () => {
  test("createTicketFile appends a named file with empty content", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());

    const file = await createTicketFile({ storage, ticketId: "ticket-1", name: "notes.md" });

    expect(file).toMatchObject({ name: "notes.md", content: "" });
    const stored = await ticketsCollection(storage).get("ticket-1");
    expect(stored?.files?.map((entry) => entry.id)).toEqual([file.id]);
  });

  test("updateTicketFile writes the file content without touching siblings", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const first = await createTicketFile({ storage, ticketId: "ticket-1", name: "a.md" });
    const second = await createTicketFile({ storage, ticketId: "ticket-1", name: "b.md" });

    await updateTicketFile({ storage, ticketId: "ticket-1", fileId: first.id, content: "hello" });

    const stored = await ticketsCollection(storage).get("ticket-1");
    expect(stored?.files?.find((entry) => entry.id === first.id)?.content).toBe("hello");
    expect(stored?.files?.find((entry) => entry.id === second.id)?.content).toBe("");
  });

  test("deleteTicketFile removes only the targeted file", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const first = await createTicketFile({ storage, ticketId: "ticket-1", name: "a.md" });
    const second = await createTicketFile({ storage, ticketId: "ticket-1", name: "b.md" });

    await deleteTicketFile({ storage, ticketId: "ticket-1", fileId: first.id });

    const stored = await ticketsCollection(storage).get("ticket-1");
    expect(stored?.files?.map((entry) => entry.id)).toEqual([second.id]);
  });
});
