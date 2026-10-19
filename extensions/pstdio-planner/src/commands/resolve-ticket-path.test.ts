import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { ticketFilesDir, ticketMarkdownPath } from "../data/draft-storage";
import type { StoredTicket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { resolveTicketPathCommand } from "./resolve-ticket-path";

test("ticket draft paths open the ticket and saved file paths select the document", async () => {
  const storage = createMemoryStorage();
  const ticket: StoredTicket = {
    id: "ticket-1",
    shorthand: "T-1",
    title: "Fix links",
    content: "",
    statusId: null,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-10-16",
    updatedAt: "2026-10-16",
    files: [{ id: "notes", name: "notes.md", content: "", createdAt: "2026-10-16", updatedAt: "2026-10-16" }],
  };
  await ticketsCollection(storage).put(ticket.id, ticket);
  const resolve = (path: string) =>
    resolveTicketPathCommand.run(...makeCommandArgs({ storage, params: { path, workspaceId: "workspace" } }));
  expect(await resolve(ticketMarkdownPath("T-1"))).toMatchObject({
    resource: { id: ticket.id, label: "T-1 Fix links", icon: "component" },
    target: { page: { id: "ticket" }, resource: { id: ticket.id }, parent: { page: { id: "tickets" } } },
  });
  expect(await resolve(`${ticketFilesDir("T-1")}/notes.md`)).toMatchObject({
    resource: { label: "notes.md", metadata: { documentId: "notes" } },
    target: { resource: { metadata: { documentId: "notes" } } },
  });
  expect(await resolve(ticketMarkdownPath("T-99"))).toBeNull();
  expect(await resolve(`${ticketFilesDir("T-1")}/missing.md`)).toBeNull();
  expect(await resolve(ticketMarkdownPath("T-1").replace("ticket.md", "notes.md"))).toBeNull();
});
