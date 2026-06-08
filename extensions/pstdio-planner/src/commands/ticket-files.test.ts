import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicketAttachment } from "../data/types";
import { attachTicketFileCommand } from "./attach-ticket-file";
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
    // The editor filters the broadcast by ticketId, so the result must carry it.
    expect(file).toMatchObject({ ticketId: ticket.id });

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );

    expect(body).toEqual([
      {
        id: "files",
        label: "Files",
        collapsible: false,
        actions: [
          {
            id: "create",
            label: "New file",
            icon: "Plus",
            commandId: "pstdio-planner.create-ticket-file",
            args: { ticketId: ticket.id },
          },
        ],
        nodes: [
          {
            id: "__ticket__",
            label: "Ticket",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-planner.select-ticket-file",
              args: { ticketId: ticket.id },
            },
          },
          {
            id: file.id,
            label: "notes.md",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-planner.select-ticket-file",
              args: { ticketId: ticket.id, fileId: file.id },
            },
            contextMenuActions: [
              {
                id: "rename",
                label: "Rename",
                icon: "Pencil",
                commandId: "pstdio-planner.rename-ticket-file",
                args: { ticketId: ticket.id, fileId: file.id, name: "notes.md" },
                params: {
                  name: { type: "text", label: "File name", required: true, defaultValue: "notes.md" },
                },
              },
              {
                id: "delete",
                label: "Delete",
                icon: "Trash",
                commandId: "pstdio-planner.delete-ticket-file",
                args: { ticketId: ticket.id, fileId: file.id },
              },
            ],
          },
        ],
      },
    ]);
  });

  test("appends image attachments to the Files section and skips non-image attachments", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const makeAttachment = (name: string, mimeType: string): StoredTicketAttachment => ({
      id: `att-${name}`,
      name,
      mimeType,
      size: 1,
      hash: "",
      url: `memory://${name}`,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    await attachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, ref: makeAttachment("diagram.png", "image/png") } }),
    );
    await attachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, ref: makeAttachment("notes.txt", "text/plain") } }),
    );

    const [section] = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );

    expect(section.nodes).toEqual([
      {
        id: "__ticket__",
        label: "Ticket",
        icon: "FileText",
        target: { kind: "command", commandId: "pstdio-planner.select-ticket-file", args: { ticketId: ticket.id } },
      },
      {
        id: "att-diagram.png",
        label: "diagram.png",
        icon: "Image",
        target: {
          kind: "command",
          commandId: "pstdio-planner.select-ticket-file",
          args: { ticketId: ticket.id, fileId: "att-diagram.png" },
        },
      },
    ]);

    // Make sure the collection actually stored both attachments; only the image is surfaced.
    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.attachments).toHaveLength(2);
  });

  test("creates a ticket file from the selected ticket resource without a ticketId param", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const file = await createTicketFileCommand.run(
      makeCommandContext({
        storage,
        params: { name: "notes.md" },
        overrides: { resource: { type: "ticket", id: ticket.id, label: ticket.shorthand } },
      }),
    );

    expect(file).toMatchObject({ ticketId: ticket.id, name: "notes.md" });
  });

  test("returns an empty files tree without a ticket resource", async () => {
    const storage = createMemoryStorage();

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
        },
      }),
    );

    expect(body).toEqual([{ id: "files", label: "Files", collapsible: false, nodes: [] }]);
  });
});
