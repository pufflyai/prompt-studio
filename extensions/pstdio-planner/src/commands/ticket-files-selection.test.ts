import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createTicketFileCommand, listTicketFilesTreeCommand, renameTicketFileCommand } from "./ticket-files";

describe("ticket files tree selection commands", () => {
  test("creates a ticket file from the selected ticket resource without a ticketId param", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));

    const file = await createTicketFileCommand.run(
      ...makeCommandArgs({
        storage,
        params: { name: "notes.md" },
        overrides: { resource: { type: "ticket", id: ticket.id, label: ticket.shorthand } },
      }),
    );

    expect(file).toMatchObject({ ticketId: ticket.id, name: "notes.md" });
  });

  test("keeps the current file extension when renaming a ticket file", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );

    await renameTicketFileCommand.run(
      ...makeCommandArgs({ storage, params: { ticketId: ticket.id, fileId: file.id, name: "summary" } }),
    );

    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.files?.find((entry) => entry.id === file.id)?.name).toBe("summary.md");
  });

  test("returns an empty files tree without a ticket resource", async () => {
    const storage = createMemoryStorage();

    const body = await listTicketFilesTreeCommand.run(
      ...makeCommandArgs({
        storage,
        params: {
          renderer: { rendererId: "pstdio-planner.ticketFiles" },
        },
      }),
    );

    expect(body).toEqual([
      {
        id: "files",
        label: "Files",
        collapsible: true,
        nodes: [{ id: "files-empty", label: "No files", icon: "FileText", disabled: true, rowVariant: "empty-state" }],
      },
    ]);
    expect(body[0]).not.toHaveProperty("canHide");
    expect(body[0]).not.toHaveProperty("emptyState");
  });
});
