import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createTicketFileCommand, listTicketFilesTreeCommand } from "./ticket-files";

describe("ticket files tree commands", () => {
  test("returns a native tree section for the ticket body and editable files", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-core-tickets.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );

    expect(body).toEqual([
      {
        id: "files",
        label: "Files",
        collapsible: false,
        nodes: [
          {
            id: "__ticket__",
            label: "Ticket",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-core-tickets.select-ticket-file",
              args: { ticketId: ticket.id },
            },
          },
          {
            id: file.id,
            label: "notes.md",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-core-tickets.select-ticket-file",
              args: { ticketId: ticket.id, fileId: file.id },
            },
            contextMenuActions: [
              {
                id: "delete",
                label: "Delete",
                icon: "Trash",
                commandId: "pstdio-core-tickets.delete-ticket-file",
                args: { ticketId: ticket.id, fileId: file.id },
              },
            ],
          },
        ],
      },
    ]);
  });

  test("returns an empty files tree without a ticket resource", async () => {
    const storage = createMemoryStorage();

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-core-tickets.ticketFiles",
        },
      }),
    );

    expect(body).toEqual([{ id: "files", label: "Files", collapsible: false, nodes: [] }]);
  });
});
