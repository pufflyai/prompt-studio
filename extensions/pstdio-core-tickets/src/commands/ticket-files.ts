import { defineCommand, params } from "@pstdio/sdk/extensions";
import { createTicketFile, deleteTicketFile, updateTicketFile } from "../data/file-operations";

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

// The files tree and the editor render in separate webviews. Selecting a file
// runs this command purely so the host broadcasts it on the command feed; the
// editor webview watches that feed and opens the chosen file. An empty fileId
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
