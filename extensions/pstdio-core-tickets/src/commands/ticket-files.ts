import { defineCommand, params, type TreeViewSection } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "../data/file-operations";

const TICKET_BODY_ID = "__ticket__";

type TicketTreeResource = {
  type?: string;
  id?: string;
  label?: string;
};

const emptyFilesSection = (): TreeViewSection => ({
  id: "files",
  label: "Files",
  collapsible: false,
  nodes: [],
});

export const createTicketFileCommand = defineCommand({
  title: "Create ticket file",
  description: "Add an editable file to a ticket.",
  params: {
    ticketId: params.text({ required: true }),
    name: params.text({ label: "File name", required: true }),
  },
  async run(ctx) {
    return createTicketFile({ storage: ctx.storage, ticketId: ctx.params.ticketId, name: ctx.params.name });
  },
});

export const updateTicketFileCommand = defineCommand({
  title: "Update ticket file",
  description: "Save a ticket file's content.",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
    content: params.longText(),
    name: params.text(),
  },
  async run(ctx) {
    return updateTicketFile({
      storage: ctx.storage,
      ticketId: ctx.params.ticketId,
      fileId: ctx.params.fileId,
      content: ctx.params.content,
      name: ctx.params.name,
    });
  },
});

export const deleteTicketFileCommand = defineCommand({
  title: "Delete ticket file",
  description: "Remove a file from a ticket.",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx) {
    return deleteTicketFile({ storage: ctx.storage, ticketId: ctx.params.ticketId, fileId: ctx.params.fileId });
  },
});

// Selecting a file runs this command so the host broadcasts it on the command
// feed; the editor watches that feed and opens the chosen file. An empty fileId
// selects the ticket body.
export const selectTicketFileCommand = defineCommand({
  title: "Open ticket file",
  description: "Broadcast which ticket file the editor should open.",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text(),
  },
  async run(ctx) {
    return { ticketId: ctx.params.ticketId, fileId: ctx.params.fileId ?? null };
  },
});

export const listTicketFilesTreeCommand = defineCommand({
  title: "List ticket files tree",
  description: "Return the native tree renderer body for a ticket's editable files.",
  params: {
    treeId: params.text(),
    resource: params.json<TicketTreeResource>(),
  },
  async run(ctx) {
    const ticketId = ctx.params.resource?.type === "ticket" ? ctx.params.resource.id : undefined;
    if (!ticketId) return [emptyFilesSection()];

    const ticket = await ticketsCollection(ctx.storage).get(ticketId);
    if (!ticket) return [emptyFilesSection()];

    return [
      {
        ...emptyFilesSection(),
        nodes: [
          {
            id: TICKET_BODY_ID,
            label: "Ticket",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-core-tickets.select-ticket-file",
              args: { ticketId },
            },
          },
          ...(ticket.files ?? []).map((file) => ({
            id: file.id,
            label: file.name,
            icon: "FileText",
            target: {
              kind: "command" as const,
              commandId: "pstdio-core-tickets.select-ticket-file",
              args: { ticketId, fileId: file.id },
            },
            contextMenuActions: [
              {
                id: "delete",
                label: "Delete",
                icon: "Trash",
                commandId: "pstdio-core-tickets.delete-ticket-file",
                args: { ticketId, fileId: file.id },
              },
            ],
          })),
        ],
      },
    ] satisfies TreeViewSection[];
  },
});
