import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { listTicketFiles as listLocalTicketFiles } from "../local-ticket-workflow/local-ticket-artifacts";
import { createPlannerStorage } from "../storage/planner-storage";
import {
  booleanParam,
  formatTable,
  isCliRun,
  optionalBooleanParam,
  resolveProjectRoot,
  stringArrayParam,
  stringParam,
  stringParamAny,
  ticketIdParam,
} from "./shared";

export const ticketReadCommands = {
  listTickets: {
    title: "List planner tickets",
    target: "project",
    cli: {
      path: "tickets list",
      description: "List planner-owned tickets.",
      options: {
        status: { type: "string", description: "Filter by status name." },
        tag: { type: "string", description: "Filter by tag option name. Can be passed more than once." },
        archived: { type: "boolean", description: "Show archived tickets." },
        draft: { type: "boolean", description: "Filter by draft state." },
        "parent-id": { type: "string", description: "Filter by parent ticket." },
      },
    },
    async run(ctx: CommandRunContext) {
      const storage = createPlannerStorage(ctx);
      const tagFilters = stringArrayParam(ctx, "tag") ?? [];
      const statusFilter = stringParam(ctx, "status");
      const parentFilter = stringParamAny(ctx, ["parent_id", "parentId", "parent-id"]);
      const tickets = (
        await storage.listDetails({
          archived: booleanParam(ctx, "archived"),
          draft: optionalBooleanParam(ctx, "draft"),
        })
      )
        .filter((ticket) => (statusFilter ? ticket.statusName === statusFilter : true))
        .filter((ticket) => (parentFilter ? ticket.parentId === parentFilter : true))
        .filter((ticket) => tagFilters.every((tag) => ticket.tagNames.includes(tag)));

      if (!isCliRun(ctx)) return tickets;
      if (tickets.length === 0) return "No tickets found.";

      return formatTable(
        { shorthand: "Shorthand", title: "Title", status: "Status", tags: "Tags" },
        tickets.map((ticket) => ({
          shorthand: ticket.shorthand,
          title: ticket.displayTitle ?? "",
          status: ticket.statusName ?? "",
          tags: ticket.tagNames.join(", "),
        })),
      );
    },
  },
  viewTicket: {
    title: "View planner ticket",
    target: "project",
    cli: {
      path: "tickets view",
      description: "View planner-owned ticket details.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
      },
      positionals: {
        field: { type: "string", description: "Single field to output: status, title, tags, shorthand." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const ticket = await createPlannerStorage(ctx).getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

      const field = stringParam(ctx, "field");
      const fields: Record<string, string | null> = {
        shorthand: ticket.shorthand,
        title: ticket.displayTitle,
        status: ticket.statusName,
        tags: ticket.tagNames.length ? ticket.tagNames.join(", ") : null,
      };
      if (field) {
        if (!(field in fields))
          throw new Error(`Unknown field: ${field}. Valid fields: ${Object.keys(fields).join(", ")}`);
        return fields[field] ?? "";
      }

      if (!isCliRun(ctx)) return ticket;
      const line = (label: string, value: string | null) => `${`${label}:`.padEnd(13)}${value ?? "-"}`;
      return [
        line("Shorthand", ticket.shorthand),
        line("Title", ticket.displayTitle),
        line("Status", ticket.statusName),
        line("Tags", ticket.tagNames.length ? ticket.tagNames.join(", ") : null),
        line("Created", ticket.createdAt),
        line("Updated", ticket.updatedAt),
      ].join("\n");
    },
  },
  listTicketFiles: {
    title: "List planner ticket files",
    target: "project",
    cli: {
      path: "tickets files",
      description: "List planner-owned and local ticket files.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const storage = createPlannerStorage(ctx);
      const ticket = await storage.getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

      const projectRoot = await resolveProjectRoot(ctx);
      const dbFiles = await storage.provider.listFiles(ticket.id);
      const localFiles = listLocalTicketFiles(projectRoot, ticket.shorthand);
      const rows = [...new Set([...dbFiles.map((file) => file.fileName), ...localFiles])].sort().map((fileName) => ({
        fileName,
        db: dbFiles.some((file) => file.fileName === fileName) ? "yes" : "no",
        local: localFiles.includes(fileName) ? "yes" : "no",
        localPath: localFiles.includes(fileName) ? `.pstdio/tickets/${ticket.shorthand}/files/${fileName}` : "-",
      }));

      if (!isCliRun(ctx)) return dbFiles;
      if (rows.length === 0) return "No ticket files found.";
      return formatTable({ fileName: "File Name", db: "DB", local: "Local", localPath: "Local Path" }, rows);
    },
  },
} satisfies Record<string, CommandDefinition>;
