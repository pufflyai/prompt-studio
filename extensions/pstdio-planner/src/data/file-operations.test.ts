import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketsCollection, updateTicket } from "./collections";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "./file-operations";
import { readTicketFileContent } from "./ticket-file-content";
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
  test.each([
    "../outside.txt",
    "../../outside.txt",
    "/outside.txt",
    "nested/../file.txt",
    "..\\outside.txt",
    ".",
    "..",
    "C:outside.txt",
    "bad\u0000.txt",
  ])("rejects unsafe file name %j without changing stored files", async (name) => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const file = await createTicketFile({ storage, ticketId: "ticket-1", name: "notes.md" });
    await expect(createTicketFile({ storage, ticketId: "ticket-1", name })).rejects.toThrow("Invalid ticket file name");
    await expect(updateTicketFile({ storage, ticketId: "ticket-1", fileId: file.id, name })).rejects.toThrow(
      "Invalid ticket file name",
    );
    expect((await ticketsCollection(storage).get("ticket-1"))?.files).toEqual([file]);
  });

  test.each(["notes.md", "screenshots/diagram.svg"])("createTicketFile appends %s with empty content", async (name) => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());

    const file = await createTicketFile({ storage, ticketId: "ticket-1", name });

    expect(file.name).toBe(name);
    expect(await readTicketFileContent(storage, "ticket-1", file)).toBe("");
    const stored = await ticketsCollection(storage).get("ticket-1");
    expect(stored?.files?.map((entry) => entry.id)).toEqual([file.id]);
  });

  test("createTicketFile generates a unique default name when none is given", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());

    const first = await createTicketFile({ storage, ticketId: "ticket-1" });
    const second = await createTicketFile({ storage, ticketId: "ticket-1" });

    expect(first.name).toBe("untitled.md");
    expect(second.name).toBe("untitled-1.md");
  });

  test("updateTicketFile writes the file content without touching siblings", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const first = await createTicketFile({ storage, ticketId: "ticket-1", name: "a.md" });
    const second = await createTicketFile({ storage, ticketId: "ticket-1", name: "b.md" });

    await updateTicketFile({ storage, ticketId: "ticket-1", fileId: first.id, content: "hello" });

    const stored = await ticketsCollection(storage).get("ticket-1");
    const files = new Map(stored?.files?.map((entry) => [entry.id, entry]));
    expect(await readTicketFileContent(storage, "ticket-1", files.get(first.id)!)).toBe("hello");
    expect(await readTicketFileContent(storage, "ticket-1", files.get(second.id)!)).toBe("");
  });

  test("file bodies stay out of the ticket record and replaced bodies are deleted", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const blobs = storage.scope({ type: "resource", resource: { type: "ticket", id: "ticket-1" } }).files;
    const file = await createTicketFile({ storage, ticketId: "ticket-1", name: "report.md" });
    const body = "x".repeat(100_000);

    const updated = await updateTicketFile({ storage, ticketId: "ticket-1", fileId: file.id, content: body });

    expect(JSON.stringify(await ticketsCollection(storage).get("ticket-1")).length).toBeLessThan(1_000);
    expect(await readTicketFileContent(storage, "ticket-1", updated!)).toBe(body);
    expect(await blobs.get(file.blobId)).toBeUndefined();
    await deleteTicketFile({ storage, ticketId: "ticket-1", fileId: file.id });
    expect(await blobs.list()).toEqual([]);
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

  test.each([
    ["content first", true],
    ["rename first", false],
  ])("a rename racing a content save keeps both changes and a readable body (%s)", async (_order, contentFirst) => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const file = await createTicketFile({ storage, ticketId: "ticket-1", name: "a.md" });
    const save = () => updateTicketFile({ storage, ticketId: "ticket-1", fileId: file.id, content: "new body" });
    const rename = () => updateTicketFile({ storage, ticketId: "ticket-1", fileId: file.id, name: "b.md" });

    await Promise.all(contentFirst ? [save(), rename()] : [rename(), save()]);

    const [stored] = (await ticketsCollection(storage).get("ticket-1"))?.files ?? [];
    expect(stored.name).toBe("b.md");
    expect(await readTicketFileContent(storage, "ticket-1", stored)).toBe("new body");
  });

  test("a ticket write that read the ticket before a file save keeps the saved body", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, ticket());
    const file = await createTicketFile({ storage, ticketId: "ticket-1", name: "a.md" });
    const stale = (await ticketsCollection(storage).get("ticket-1"))!;

    await updateTicketFile({ storage, ticketId: "ticket-1", fileId: file.id, content: "new body" });
    await updateTicket(storage, { ...stale, title: "Renamed" });

    const stored = (await ticketsCollection(storage).get("ticket-1"))!;
    expect(stored.title).toBe("Renamed");
    expect(await readTicketFileContent(storage, "ticket-1", stored.files![0])).toBe("new body");
  });
});
