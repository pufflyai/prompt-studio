import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { removeTicketDir, writeTicketFile } from "../local-ticket-workflow/local-ticket-artifacts";
import { createPlannerStorage } from "../storage/planner-storage";
import {
  booleanParamAny,
  buildLocalTicketContent,
  extractTitle,
  isCliRun,
  nextTicketShorthand,
  normalizeTicketContent,
  optionalBooleanParam,
  resolveProjectRoot,
  resolveStatusId,
  resolveTagIds,
  stringArrayParam,
  stringParam,
  stringParamAny,
  ticketIdParam,
} from "./shared";

export const ticketCoreCommands = {
  createTicket: {
    title: "Create planner ticket",
    target: "project",
    cli: {
      path: "tickets create",
      description: "Create a planner-owned ticket.",
      options: {
        content: { type: "string", required: true, description: "Ticket content or title." },
        status: { type: "string", description: "Status name to assign." },
        "parent-id": { type: "string", description: "Parent ticket shorthand or id." },
        tag: { type: "string", description: "Tag option name to assign. Can be passed more than once." },
      },
    },
    params: {
      shorthand: { type: "text" },
      content: { type: "longtext", required: true },
      title: { type: "text" },
      draft: { type: "boolean" },
      parent_id: { type: "text" },
      user_prompt: { type: "longtext" },
      status: { type: "text" },
      status_id: { type: "text" },
      tags: { type: "text" },
      tag_ids: { type: "text" },
    },
    async run(ctx: CommandRunContext) {
      const storage = createPlannerStorage(ctx);
      const shorthand = stringParam(ctx, "shorthand") ?? (await nextTicketShorthand(ctx, storage));
      const content = normalizeTicketContent(stringParam(ctx, "content")!);
      const parentId = stringParamAny(ctx, ["parent_id", "parentId", "parent-id"]) ?? null;
      const tagNames = stringArrayParam(ctx, "tag") ?? stringArrayParam(ctx, "tags") ?? [];
      const ticket = await storage.createTicket({
        shorthand,
        content,
        title: stringParam(ctx, "title") ?? extractTitle(content) ?? undefined,
        draft: optionalBooleanParam(ctx, "draft"),
        parentId,
        userPrompt: stringParam(ctx, "user_prompt") ?? stringParam(ctx, "userPrompt") ?? null,
        statusId: (await resolveStatusId(ctx, storage)) ?? null,
        tagIds: await resolveTagIds(ctx, storage),
      });

      await ctx.activity.record({
        eventType: "ticket.created",
        summary: `Created ticket ${ticket.shorthand}`,
        target: {
          type: "pstdio.planner.ticket",
          id: ticket.id,
          projectId: ctx.projectId,
          extensionId: "pstdio.planner",
        },
      });

      if (isCliRun(ctx)) {
        const projectRoot = await resolveProjectRoot(ctx);
        writeTicketFile(
          projectRoot,
          ticket.shorthand,
          buildLocalTicketContent({
            shorthand: ticket.shorthand,
            createdAt: ticket.createdAt,
            draft: false,
            content,
            parentId,
            tags: tagNames,
          }),
        );
        return `Created ticket ${ticket.shorthand}`;
      }

      return ticket;
    },
  },
  updateTicket: {
    title: "Update planner ticket",
    target: "project",
    cli: {
      path: "tickets update",
      description: "Update a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand to update." },
        status: { type: "string", description: "Status name to assign." },
        tag: { type: "string", description: "Tag option name to assign. Can be passed more than once." },
        "parent-id": { type: "string", description: "Parent ticket shorthand or id." },
        "no-parent-id": { type: "boolean", description: "Clear parent ticket." },
      },
    },
    async run(ctx: CommandRunContext) {
      const storage = createPlannerStorage(ctx);
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");

      const parentId = booleanParamAny(ctx, ["no_parent_id", "noParentId", "no-parent-id"])
        ? null
        : stringParamAny(ctx, ["parent_id", "parentId", "parent-id"]);
      const updated = await storage.provider.update(ticketId, {
        blockedReason: stringParam(ctx, "blocked_reason") ?? stringParam(ctx, "blockedReason"),
        content: stringParam(ctx, "content"),
        displayTitle: stringParam(ctx, "display_title") ?? stringParam(ctx, "displayTitle"),
        draft: optionalBooleanParam(ctx, "draft"),
        archived: optionalBooleanParam(ctx, "archived"),
        fileId: stringParam(ctx, "file_id") ?? stringParam(ctx, "fileId"),
        parentId,
        userPrompt: stringParam(ctx, "user_prompt") ?? stringParam(ctx, "userPrompt"),
        statusId: await resolveStatusId(ctx, storage),
        tagIds: await resolveTagIds(ctx, storage),
      });

      if (!updated) throw new Error(`Ticket not found: ${ticketId}`);

      await ctx.activity.record({
        eventType: "ticket.updated",
        summary: `Updated ticket ${updated.shorthand}`,
        target: {
          type: "pstdio.planner.ticket",
          id: updated.id,
          projectId: ctx.projectId,
          extensionId: "pstdio.planner",
        },
      });

      if (isCliRun(ctx)) return `Updated ticket ${updated.shorthand}`;

      return updated;
    },
  },
  uploadTicketFile: {
    title: "Upload planner ticket file",
    target: "project",
    params: {
      ticket_id: { type: "text", required: true },
      file_name: { type: "text", required: true },
      relative_path: { type: "text" },
      content_base64: { type: "longtext", required: true },
      mime_type: { type: "text" },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");

      return createPlannerStorage(ctx).provider.uploadFile(ticketId, {
        fileName: stringParam(ctx, "file_name") ?? stringParam(ctx, "fileName") ?? "ticket.md",
        relativePath: stringParam(ctx, "relative_path") ?? stringParam(ctx, "relativePath"),
        content: Buffer.from(stringParam(ctx, "content_base64") ?? stringParam(ctx, "contentBase64") ?? "", "base64"),
        mimeType: stringParam(ctx, "mime_type") ?? stringParam(ctx, "mimeType") ?? null,
      });
    },
  },
  archiveTicket: {
    title: "Archive planner ticket",
    target: "project",
    cli: {
      path: "tickets archive",
      description: "Archive a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand to archive." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");

      const updated = await createPlannerStorage(ctx).provider.update(ticketId, { archived: true });
      if (!updated) throw new Error(`Ticket not found: ${ticketId}`);

      await ctx.activity.record({
        eventType: "ticket.archived",
        summary: `Archived ticket ${updated.shorthand}`,
        target: {
          type: "pstdio.planner.ticket",
          id: updated.id,
          projectId: ctx.projectId,
          extensionId: "pstdio.planner",
        },
      });

      if (isCliRun(ctx)) return `Archived ticket ${updated.shorthand}`;

      return updated;
    },
  },
  deleteTicket: {
    title: "Delete planner ticket",
    target: "project",
    cli: {
      path: "tickets delete",
      description: "Delete a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand to delete." },
        "repo-path": { type: "string", description: "Repository path containing local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");

      const deleted = await createPlannerStorage(ctx).provider.delete(ticketId);
      if (!deleted) throw new Error(`Ticket not found: ${ticketId}`);

      await ctx.activity.record({
        eventType: "ticket.deleted",
        summary: `Deleted ticket ${ticketId}`,
        target: {
          type: "pstdio.planner.ticket",
          id: ticketId,
          projectId: ctx.projectId,
          extensionId: "pstdio.planner",
        },
      });

      if (isCliRun(ctx)) {
        const projectRoot = await resolveProjectRoot(ctx);
        removeTicketDir(projectRoot, ticketId);
        return `Deleted ticket ${ticketId}`;
      }

      return { ticketId, deleted };
    },
  },
} satisfies Record<string, CommandDefinition>;
