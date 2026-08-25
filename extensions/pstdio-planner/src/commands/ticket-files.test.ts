import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicketAttachment } from "../data/types";
import { attachTicketFileCommand } from "./attach-ticket-file";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { createTicketFileCommand, listTicketFilesTreeCommand } from "./ticket-files";

const ticketRendererParams = (ticket: { id: string; shorthand: string }, documentId?: string) => ({
  renderer: {
    rendererId: "pstdio-planner.ticketFiles",
    resource: {
      type: "ticket",
      id: ticket.id,
      label: ticket.shorthand,
      ...(documentId ? { metadata: { documentId } } : {}),
    },
  },
});

const ticketDocumentTarget = (ticket: { id: string; shorthand: string; title?: string }, documentId: string) => ({
  kind: "resource" as const,
  resource: {
    type: "ticket",
    id: ticket.id,
    label: ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand,
    metadata: {
      shorthand: ticket.shorthand,
      documentId,
      resourceParent: { type: "extension-view", id: "pstdio-planner.tickets", label: "Tickets", icon: "square-kanban" },
    },
  },
  input: { strategy: "replace-active" as const },
});

describe("ticket files tree commands", () => {
  test("returns a native tree section for the ticket body and editable files", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Write a haiku" } }));
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );
    // The editor filters the broadcast by ticketId, so the result must carry it.
    expect(file).toMatchObject({ ticketId: ticket.id });

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: ticketRendererParams(ticket),
      }),
    );

    expect(body.map((section) => section.id)).toEqual(["ticket", "files", "workspaces", "sessions"]);

    // The ticket body is its own header-less entry, selected by default.
    expect(body[0]).toEqual({
      id: "ticket",
      collapsible: false,
      nodes: [
        {
          id: "__ticket__",
          label: `${ticket.shorthand} Write a haiku`,
          icon: "component",
          target: ticketDocumentTarget(ticket, "__ticket__"),
          selected: true,
        },
      ],
    });

    // The file lives in the Files section and rebinds the editor to the selected document.
    expect(body[1]).toMatchObject({ id: "files", label: "Files" });
    expect(body[1]).not.toHaveProperty("canHide");
    expect(body[1]?.nodes).toEqual([
      {
        id: file.id,
        label: "notes.md",
        icon: "FileText",
        target: ticketDocumentTarget(ticket, file.id),
        selected: false,
        contextMenuActions: [
          {
            id: "rename",
            label: "Rename",
            icon: "Pencil",
            command: "pstdio-planner.rename-ticket-file",
            params: { ticketId: ticket.id, fileId: file.id, name: "notes.md" },
            submitLabel: "Save",
            input: {
              name: { type: "text", label: "File name", required: true, defaultValue: "notes.md" },
            },
          },
          {
            id: "delete",
            label: "Delete",
            icon: "Trash",
            command: "pstdio-planner.delete-ticket-file",
            params: { ticketId: ticket.id, fileId: file.id },
          },
        ],
      },
    ]);
    expect(body[3]).toMatchObject({
      id: "sessions",
      label: "Sessions",
      nodes: [
        {
          id: "sessions-empty",
          label: "No sessions",
          icon: "MessageCircle",
          disabled: true,
          rowVariant: "empty-state",
        },
      ],
    });
  });
});

describe("ticket file selection commands", () => {
  test("marks the selected document so the host highlights it", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: ticketRendererParams(ticket, file.id),
      }),
    );

    const allNodes = sections.flatMap((section) => section.nodes);
    expect(allNodes.find((node) => node.selected)?.id).toBe(file.id);
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

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: ticketRendererParams(ticket),
      }),
    );
    const filesSection = sections.find((section) => section.id === "files");

    expect(filesSection?.nodes).toEqual([
      {
        id: "att-diagram.png",
        label: "diagram.png",
        icon: "Image",
        target: ticketDocumentTarget(ticket, "att-diagram.png"),
        selected: false,
      },
    ]);

    // Make sure the collection actually stored both attachments; only the image is surfaced.
    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.attachments).toHaveLength(2);
  });
});
