import { defineCommand, params, type TreeAction, type TreeViewSection } from "@pstdio/sdk/extensions";
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

const selectedTicketId = (ctx: { params: { ticketId?: string }; resource?: { type?: string; id?: string } }) =>
  ctx.params.ticketId ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);

const fileContextMenuActions = (input: { ticketId: string; fileId: string; fileName: string }) => {
  const actions: TreeAction[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "Pencil",
      commandId: "pstdio-planner.rename-ticket-file",
      args: { ticketId: input.ticketId, fileId: input.fileId, name: input.fileName },
      params: {
        name: params.text({ label: "File name", required: true, defaultValue: input.fileName }),
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: "Trash",
      commandId: "pstdio-planner.delete-ticket-file",
      args: { ticketId: input.ticketId, fileId: input.fileId },
    },
  ];
  return actions;
};

export const createTicketFileCommand = defineCommand({
  title: "Create ticket file",
  palette: { group: "Tickets", when: { resourceType: ["ticket"] } },
  params: {
    ticketId: params.text(),
    name: params.text({ label: "File name" }),
  },
  async run(ctx) {
    const ticketId = selectedTicketId(ctx);
    if (!ticketId) throw new Error("Ticket resource is required.");
    const file = await createTicketFile({ storage: ctx.storage, ticketId, name: ctx.params.name });
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ...file, ticketId };
  },
});

export const updateTicketFileCommand = defineCommand({
  title: "Update ticket file",
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

export const renameTicketFileCommand = defineCommand({
  title: "Rename ticket file",
  params: {
    name: params.text({ label: "File name", required: true }),
  },
  async run(ctx) {
    const input = ctx.params as typeof ctx.params & { ticketId: string; fileId: string };
    return updateTicketFile({
      storage: ctx.storage,
      ticketId: input.ticketId,
      fileId: input.fileId,
      name: input.name.trim(),
    });
  },
});

export const deleteTicketFileCommand = defineCommand({
  title: "Delete ticket file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx) {
    await deleteTicketFile({ storage: ctx.storage, ticketId: ctx.params.ticketId, fileId: ctx.params.fileId });
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ticketId: ctx.params.ticketId, fileId: ctx.params.fileId };
  },
});

// Selecting a file runs this command so the host broadcasts it on the command
// feed; the editor watches that feed and opens the chosen file. An empty fileId
// selects the ticket body.
export const selectTicketFileCommand = defineCommand({
  title: "Open ticket file",
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
        actions: [
          {
            id: "create",
            label: "New file",
            icon: "Plus",
            commandId: "pstdio-planner.create-ticket-file",
            args: { ticketId },
          },
        ],
        nodes: [
          {
            id: TICKET_BODY_ID,
            label: "Ticket",
            icon: "FileText",
            target: {
              kind: "command",
              commandId: "pstdio-planner.select-ticket-file",
              args: { ticketId },
            },
          },
          ...(ticket.files ?? []).map((file) => ({
            id: file.id,
            label: file.name,
            icon: "FileText",
            target: {
              kind: "command" as const,
              commandId: "pstdio-planner.select-ticket-file",
              args: { ticketId, fileId: file.id },
            },
            contextMenuActions: fileContextMenuActions({ ticketId, fileId: file.id, fileName: file.name }),
          })),
        ],
      },
    ] satisfies TreeViewSection[];
  },
});
