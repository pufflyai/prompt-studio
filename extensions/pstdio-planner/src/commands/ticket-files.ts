import { defineCommand, params, type TreeAction } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { selectedDocumentFromResource } from "../data/document-selection";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "../data/file-operations";
import { ticketPageTarget } from "../data/ticket-page-target";
import { plannerOwnerFor, readTicketParentLookup, ticketResourceReference } from "../data/ticket-resource-hierarchy";
import { plannerTicketsChanged } from "../events";

const ticketResourceKind = { extensionId: "pstdio.pstdio-planner", kind: "resource-kind", id: "ticket" } as const;

const fileEnding = (name: string) => {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex) : "";
};

const removeFileEnding = (name: string) => {
  const ending = fileEnding(name);
  return ending ? name.slice(0, -ending.length) : name;
};

const renameWithCurrentFileEnding = (name: string, currentName: string) => {
  const nextName = removeFileEnding(name.trim());
  return `${nextName}${fileEnding(currentName)}`;
};

const selectedTicketId = (ctx: { resource?: { type?: string; id?: string } }, commandParams: { ticketId?: string }) =>
  commandParams.ticketId ?? (ctx.resource?.type === "ticket" ? ctx.resource.id : undefined);

export const fileContextMenuActions = (input: { ticketId: string; fileId: string; fileName: string }) => {
  const actions: TreeAction[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "Pencil",
      command: renameTicketFileCommand.ref,
      params: { ticketId: input.ticketId, fileId: input.fileId, name: input.fileName },
      submitLabel: "Save",
      input: {
        name: params.text({ label: "File name", required: true, defaultValue: input.fileName }),
      },
    },
    {
      id: "delete",
      label: "Delete",
      icon: "Trash",
      command: deleteTicketFileCommand.ref,
      params: { ticketId: input.ticketId, fileId: input.fileId },
    },
  ];
  return actions;
};

export const createTicketFileCommand = defineCommand({
  id: "create-ticket-file",
  title: "Create ticket file",
  palette: [{ group: "Tickets", icon: "file-plus", when: { resourceType: [ticketResourceKind] } }],
  params: {
    ticketId: params.text(),
    name: params.text({ label: "File name" }),
  },
  async run(ctx, commandParams) {
    const ticketId = selectedTicketId(ctx, commandParams);
    if (!ticketId) throw new Error("Ticket resource is required.");
    const file = await createTicketFile({
      storage: ctx.storage,
      resources: ctx.resources,
      ticketId,
      name: commandParams.name,
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId });
    // ticketId travels with the result so the editor can filter the broadcast.
    return { ...file, ticketId };
  },
});

export const updateTicketFileCommand = defineCommand({
  id: "update-ticket-file",
  title: "Update ticket file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
    content: params.longText(),
    name: params.text(),
  },
  async run(ctx, commandParams) {
    const ticket = await updateTicketFile({
      storage: ctx.storage,
      resources: ctx.resources,
      ticketId: commandParams.ticketId,
      fileId: commandParams.fileId,
      content: commandParams.content,
      name: commandParams.name,
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: commandParams.ticketId });
    return ticket;
  },
});

export const renameTicketFileCommand = defineCommand({
  id: "rename-ticket-file",
  title: "Rename ticket file",
  params: {
    name: params.text({ label: "File name", required: true }),
  },
  async run(ctx, commandParams) {
    const input = commandParams as typeof commandParams & { ticketId: string; fileId: string };
    const ticket = await ticketsCollection(ctx).get(input.ticketId);
    const file = ticket?.files?.find((entry) => entry.id === input.fileId);
    const updated = await updateTicketFile({
      storage: ctx.storage,
      resources: ctx.resources,
      ticketId: input.ticketId,
      fileId: input.fileId,
      name: renameWithCurrentFileEnding(input.name, file?.name ?? ""),
    });
    await ctx.events.emit(plannerTicketsChanged, { ticketId: input.ticketId });
    return updated;
  },
});

export const deleteTicketFileCommand = defineCommand({
  id: "delete-ticket-file",
  title: "Delete ticket file",
  params: {
    ticketId: params.text({ required: true }),
    fileId: params.text({ required: true }),
  },
  async run(ctx, commandParams) {
    const { ticketId, fileId } = commandParams;
    await deleteTicketFile({ storage: ctx.storage, resources: ctx.resources, ticketId, fileId });
    await ctx.events.emit(plannerTicketsChanged, { ticketId });
    if (selectedDocumentFromResource(ctx.resource) !== fileId) return { ticketId, fileId };

    // The open document is gone, so the page moves back to the ticket body.
    const ticket = await ticketsCollection(ctx).get(ticketId);
    if (!ticket) return { ticketId, fileId };
    const lookup = await readTicketParentLookup(ctx, new Map([[ticket.id, ticket]]));
    ctx.navigation.open(ticketPageTarget(ticketResourceReference(ticket, lookup, plannerOwnerFor(ctx))));
    return { ticketId, fileId };
  },
});

export { listTicketFilesTree, listTicketFilesTreeCommand } from "./ticket-files-tree";
