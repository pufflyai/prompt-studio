import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { pullLocalTickets, pushLocalTicket } from "./local-ticket-workflow";
import { createPlannerStorage, createPlannerWorkflowContext } from "./storage/planner-storage";

const stringParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const booleanParam = (ctx: CommandRunContext, key: string) => ctx.params[key] === true;

const resolveProjectRoot = async (ctx: CommandRunContext) => {
  const repoPath = stringParam(ctx, "repo_path") ?? stringParam(ctx, "repoPath");
  if (repoPath) return repoPath;

  const repo = (await ctx.repos.getDefault()) as { path: string };
  return repo.path;
};

export const plannerCommands = {
  createTicket: {
    title: "Create planner ticket",
    target: "project",
    params: {
      shorthand: { type: "text", required: true },
      content: { type: "longtext", required: true },
      title: { type: "text" },
    },
    async run(ctx: CommandRunContext) {
      const shorthand = stringParam(ctx, "shorthand")!;
      const content = stringParam(ctx, "content")!;
      const ticket = await createPlannerStorage(ctx).createTicket({
        shorthand,
        content,
        title: stringParam(ctx, "title"),
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
} satisfies Record<string, CommandDefinition>;
