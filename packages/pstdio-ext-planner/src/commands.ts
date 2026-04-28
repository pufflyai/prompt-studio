import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { pullLocalTickets, pushLocalTicket } from "./local-ticket-workflow";
import { createPlannerStorage, createPlannerWorkflowContext } from "./storage/planner-storage";

const stringParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const stringArrayParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return value.split(",").filter(Boolean);
  return undefined;
};

const booleanParam = (ctx: CommandRunContext, key: string) => ctx.params[key] === true;

const optionalBooleanParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "boolean" ? value : undefined;
};

const ticketIdParam = (ctx: CommandRunContext) =>
  stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId") ?? stringParam(ctx, "id");

const resolveProjectRoot = async (ctx: CommandRunContext) => {
  const repoPath = stringParam(ctx, "repo_path") ?? stringParam(ctx, "repoPath");
  if (repoPath) return repoPath;

  const repo = (await ctx.repos.getDefault()) as { path: string };
  return repo.path;
};

const resolveTagIds = async (ctx: CommandRunContext, storage: ReturnType<typeof createPlannerStorage>) => {
  const tagIds = stringArrayParam(ctx, "tag_ids") ?? stringArrayParam(ctx, "tagIds");
  if (tagIds) return tagIds;

  const tagNames = stringArrayParam(ctx, "tags") ?? stringArrayParam(ctx, "tag");
  return tagNames?.length ? storage.provider.resolveTagIds(tagNames) : undefined;
};

const resolveStatusId = async (ctx: CommandRunContext, storage: ReturnType<typeof createPlannerStorage>) => {
  const statusId = stringParam(ctx, "status_id") ?? stringParam(ctx, "statusId");
  if (statusId) return statusId;

  const statusName = stringParam(ctx, "status");
  return statusName ? storage.provider.resolveStatusId(statusName) : undefined;
};

export const plannerCommands = {
  createTicket: {
    title: "Create planner ticket",
    target: "project",
    params: {
      shorthand: { type: "text", required: true },
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
      const shorthand = stringParam(ctx, "shorthand")!;
      const content = stringParam(ctx, "content")!;
      const ticket = await storage.createTicket({
        shorthand,
        content,
        title: stringParam(ctx, "title"),
        draft: optionalBooleanParam(ctx, "draft"),
        parentId: stringParam(ctx, "parent_id") ?? stringParam(ctx, "parentId") ?? null,
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
        tags: { type: "string", description: "Comma-separated tag option names to assign." },
        parent_id: { type: "string", description: "Parent ticket shorthand or id." },
        no_parent_id: { type: "boolean", description: "Clear parent ticket." },
      },
    },
    async run(ctx: CommandRunContext) {
      const storage = createPlannerStorage(ctx);
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");

      const parentId =
        booleanParam(ctx, "no_parent_id") || booleanParam(ctx, "noParentId")
          ? null
          : (stringParam(ctx, "parent_id") ?? stringParam(ctx, "parentId"));
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

      return { ticketId, deleted };
    },
  },
  pullTickets: {
    title: "Pull planner tickets",
    target: "project",
    cli: {
      path: "tickets pull",
      description: "Pull planner-owned tickets into local .pstdio ticket artifacts.",
      options: {
        id: { type: "string", description: "Ticket shorthand to pull." },
        ticket_id: { type: "string", description: "Ticket shorthand to pull." },
        force: { type: "boolean", description: "Overwrite local ticket files." },
        repo_path: { type: "string", description: "Repository path to read or write local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const projectRoot = await resolveProjectRoot(ctx);
      return pullLocalTickets(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId") ?? stringParam(ctx, "id"),
        force: booleanParam(ctx, "force"),
      });
    },
  },
  pushTicket: {
    title: "Push planner ticket",
    target: "project",
    cli: {
      path: "tickets push",
      description: "Push a local .pstdio ticket artifact into planner-owned storage.",
      options: {
        ticket_id: { type: "string", required: true, description: "Ticket shorthand to push." },
        status: { type: "string", description: "Status name to assign." },
        tags: { type: "string", description: "Comma-separated tag option names to assign." },
        repo_path: { type: "string", description: "Repository path to read or write local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const projectRoot = await resolveProjectRoot(ctx);
      const tags = stringParam(ctx, "tags")?.split(",").filter(Boolean);
      return pushLocalTicket(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId")!,
        status: stringParam(ctx, "status"),
        tags,
      });
    },
  },
  saveTicket: {
    title: "Save planner ticket",
    target: "project",
    cli: {
      path: "tickets save",
      description: "Save a local .pstdio ticket artifact into planner-owned storage.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand to save." },
        status: { type: "string", description: "Status name to assign." },
        tags: { type: "string", description: "Comma-separated tag option names to assign." },
        repo_path: { type: "string", description: "Repository path to read or write local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const projectRoot = await resolveProjectRoot(ctx);
      const tags = stringParam(ctx, "tags")?.split(",").filter(Boolean);
      return pushLocalTicket(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: ticketIdParam(ctx)!,
        status: stringParam(ctx, "status"),
        tags,
      });
    },
  },
} satisfies Record<string, CommandDefinition>;
