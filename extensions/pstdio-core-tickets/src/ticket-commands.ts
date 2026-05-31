import { type CommandDefinition, type ParamObjectSchema, params } from "@pstdio/sdk/extensions";
import { reorderTicketStatuses } from "./ticket-status";

const defineCommand = <TSchema extends ParamObjectSchema>(command: CommandDefinition<TSchema>) => command;

const stringMetadata = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const ticketRefFromContext = (ctx: {
  params: { ticket?: string };
  resource?: { type: string; id: string; label?: string; metadata?: Record<string, unknown> };
}) => {
  const ticket = ctx.params.ticket?.trim();
  if (ticket) return ticket;
  if (ctx.resource?.type !== "ticket") throw new Error("Ticket is required.");
  return stringMetadata(ctx.resource.metadata, "shorthand") ?? ctx.resource.label ?? ctx.resource.id;
};

const ticketTitle = (ticket: { shorthand: string; display_title?: string | null; displayTitle?: string | null }) =>
  [ticket.shorthand, ticket.display_title ?? ticket.displayTitle].filter(Boolean).join(" ");

const ticketFileName = (
  file: { id: string; file_name?: string | null; fileName?: string | null },
  primaryFileId: string | undefined,
) => file.file_name ?? file.fileName ?? (file.id === primaryFileId ? "ticket.md" : file.id);

const fileMimeType = (file: { mime_type?: string | null; mimeType?: string | null }) =>
  file.mime_type ?? file.mimeType ?? undefined;

const fileLanguage = (name: string, mimeType: string | undefined) =>
  mimeType === "text/markdown" || name.endsWith(".md") ? "markdown" : undefined;

const sortTicketFiles = <TFile extends { id: string; file_name?: string | null; fileName?: string | null }>(
  files: TFile[],
  primaryFileId: string | undefined,
) =>
  [...files].sort((left, right) => {
    if (left.id === primaryFileId) return -1;
    if (right.id === primaryFileId) return 1;
    return ticketFileName(left, primaryFileId).localeCompare(ticketFileName(right, primaryFileId));
  });

export const ticketBoardCommands = {
  "ticketBoard.read": defineCommand({
    title: "Read ticket board",
    description: "Read tickets and ticket statuses for the tickets board.",
    params: {},
    async run(ctx) {
      const [tickets, statuses] = await Promise.all([ctx.tickets.list({ archived: false }), ctx.ticketStatuses.list()]);
      return { tickets, statuses };
    },
  }),
};

export const ticketDocumentCommands = {
  "ticketDocument.read": defineCommand({
    title: "Read ticket document",
    description: "Read ticket content and attachments for the document editor.",
    params: {
      ticket: params.text({ label: "Ticket", required: false }),
    },
    async run(ctx) {
      const ticketRef = ticketRefFromContext(ctx);
      const ticket = await ctx.tickets.get(ticketRef);
      const primaryFileId = ticket.file_id ?? ticket.fileId ?? undefined;
      const files = sortTicketFiles(await ctx.tickets.listFiles(ticket.id), primaryFileId);

      return {
        title: ticketTitle(ticket),
        activeFileId: primaryFileId ?? files[0]?.id,
        properties: [
          { id: "shorthand", label: "Ticket", value: ticket.shorthand },
          { id: "status", label: "Status", value: ticket.status_name ?? ticket.status ?? "Unassigned" },
          { id: "tags", label: "Tags", value: (ticket.tag_names ?? ticket.tagNames ?? []).join(", ") },
          { id: "updated", label: "Updated", value: ticket.updated_at },
        ],
        files: await Promise.all(
          files.map(async (file) => {
            const name = ticketFileName(file, primaryFileId);
            const mimeType = fileMimeType(file);
            return {
              id: file.id,
              name,
              content: await ctx.files.readText(file.id),
              language: fileLanguage(name, mimeType),
              mimeType,
              editable: true,
            };
          }),
        ),
      };
    },
  }),
  "ticketDocument.update": defineCommand({
    title: "Update ticket document",
    description: "Update a ticket content file or attachment.",
    params: {
      ticket: params.text({ label: "Ticket", required: false }),
      fileId: params.text({ label: "File", required: true }),
      content: params.longText({ label: "Content", required: true }),
    },
    async run(ctx) {
      const ticketRef = ticketRefFromContext(ctx);
      const ticket = await ctx.tickets.get(ticketRef);
      const primaryFileId = ticket.file_id ?? ticket.fileId ?? undefined;

      if (ctx.params.fileId === primaryFileId) {
        await ctx.tickets.update({ ticket: ticket.shorthand, content: ctx.params.content });
        return { saved: true };
      }

      await ctx.files.writeText(ctx.params.fileId, ctx.params.content);
      return { saved: true };
    },
  }),
};

export const ticketStatusCommands = {
  "ticketStatus.read": defineCommand({
    title: "Read ticket statuses",
    description: "Read ticket status definitions.",
    params: {},
    async run(ctx) {
      return { statuses: await ctx.ticketStatuses.list() };
    },
  }),
  "ticketStatus.create": defineCommand({
    title: "Create ticket status",
    description: "Create a ticket status definition.",
    params: {
      name: params.text({ label: "Name", required: true }),
      color: params.text({ label: "Color", required: true }),
      sortOrder: params.number({ label: "Sort order", required: false }),
      isDefault: params.boolean({ label: "Default", required: false }),
      canCreate: params.boolean({ label: "Can create", required: false }),
      canDragIn: params.boolean({ label: "Can drag in", required: false }),
      canDragOut: params.boolean({ label: "Can drag out", required: false }),
      columnActions: params.json<string[]>(),
    },
    async run(ctx) {
      return ctx.ticketStatuses.create(ctx.params);
    },
  }),
  "ticketStatus.update": defineCommand({
    title: "Update ticket status",
    description: "Update a ticket status definition.",
    params: {
      statusId: params.text({ label: "Status", required: true }),
      name: params.text({ label: "Name", required: false }),
      color: params.text({ label: "Color", required: false }),
      sortOrder: params.number({ label: "Sort order", required: false }),
      canCreate: params.boolean({ label: "Can create", required: false }),
      canDragIn: params.boolean({ label: "Can drag in", required: false }),
      canDragOut: params.boolean({ label: "Can drag out", required: false }),
      columnActions: params.json<string[]>(),
    },
    async run(ctx) {
      return ctx.ticketStatuses.update(ctx.params);
    },
  }),
  "ticketStatus.setDefault": defineCommand({
    title: "Set default ticket status",
    description: "Set the default ticket status.",
    params: {
      statusId: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      await ctx.ticketStatuses.setDefault({ statusId: ctx.params.statusId });
    },
  }),
  "ticketStatus.delete": defineCommand({
    title: "Delete ticket status",
    description: "Delete a ticket status definition.",
    params: {
      statusId: params.text({ label: "Status", required: true }),
    },
    async run(ctx) {
      await ctx.ticketStatuses.delete({ statusId: ctx.params.statusId });
    },
  }),
  "ticketStatus.reorder": defineCommand({
    title: "Reorder ticket statuses",
    description: "Reorder ticket status definitions.",
    params: {
      statusIds: params.json<string[]>(),
    },
    async run(ctx) {
      return reorderTicketStatuses({
        statusIds: ctx.params.statusIds ?? [],
        ticketStatuses: ctx.ticketStatuses,
      });
    },
  }),
};
