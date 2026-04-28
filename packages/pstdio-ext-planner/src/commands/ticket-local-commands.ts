import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { pullLocalTickets, pushLocalTicket } from "../local-ticket-workflow";
import { writeTicketFile } from "../local-ticket-workflow/local-ticket-artifacts";
import { createPlannerStorage, createPlannerWorkflowContext } from "../storage/planner-storage";
import {
  booleanParam,
  buildLocalTicketContent,
  isCliRun,
  nextTicketShorthand,
  resolveProjectRoot,
  resolveStatusId,
  resolveTagIds,
  stringArrayParam,
  stringParam,
  stringParamAny,
  ticketIdParam,
} from "./shared";

const renderTemplate = (content: string, values: Record<string, string>) =>
  content.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (placeholder, key) => values[key] ?? placeholder);

export const ticketLocalCommands = {
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
      const result = await pullLocalTickets(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId") ?? stringParam(ctx, "id"),
        force: booleanParam(ctx, "force"),
      });
      return isCliRun(ctx) ? result.messages.join("\n") : result;
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
        tag: { type: "string", description: "Tag option name to assign. Can be passed more than once." },
        "repo-path": { type: "string", description: "Repository path to read or write local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const projectRoot = await resolveProjectRoot(ctx);
      const tags = stringArrayParam(ctx, "tag") ?? stringParam(ctx, "tags")?.split(",").filter(Boolean);
      const result = await pushLocalTicket(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId")!,
        status: stringParam(ctx, "status"),
        tags,
      });
      return isCliRun(ctx) ? result.messages.join("\n") : result;
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
        tag: { type: "string", description: "Tag option name to assign. Can be passed more than once." },
        "repo-path": { type: "string", description: "Repository path to read or write local ticket artifacts." },
      },
    },
    async run(ctx: CommandRunContext) {
      const projectRoot = await resolveProjectRoot(ctx);
      const tags = stringArrayParam(ctx, "tag") ?? stringParam(ctx, "tags")?.split(",").filter(Boolean);
      const result = await pushLocalTicket(createPlannerWorkflowContext(ctx, projectRoot), {
        ticketId: ticketIdParam(ctx)!,
        status: stringParam(ctx, "status"),
        tags,
      });
      return isCliRun(ctx) ? result.messages.join("\n") : result;
    },
  },
  writeTicket: {
    title: "Write planner ticket draft",
    target: "project",
    cli: {
      path: "tickets write",
      description: "Create a planner-owned draft ticket and local artifact.",
      options: {
        title: { type: "string", required: true, description: "Ticket title." },
        template: { type: "string", description: "Template name." },
        tag: { type: "string", description: "Tag option name to assign. Can be passed more than once." },
        status: { type: "string", description: "Status name to assign." },
        "user-prompt": { type: "string", description: "User prompt for the ticket." },
        "parent-id": { type: "string", description: "Parent ticket shorthand." },
      },
    },
    async run(ctx: CommandRunContext) {
      const template = stringParam(ctx, "template");
      const templateRecord = template ? await ctx.templates.get(template) : null;
      if (template && !templateRecord) throw new Error(`Template not found: ${template}`);

      const storage = createPlannerStorage(ctx);
      const title = stringParam(ctx, "title");
      if (!title) throw new Error("Ticket title is required.");

      const shorthand = await nextTicketShorthand(ctx, storage);
      const initialContent = `# ${title}\n`;
      const parentId = stringParamAny(ctx, ["parent_id", "parentId", "parent-id"]) ?? null;
      const userPrompt = stringParamAny(ctx, ["user_prompt", "userPrompt", "user-prompt"]) ?? null;
      const tagNames = stringArrayParam(ctx, "tag") ?? stringArrayParam(ctx, "tags") ?? [];

      const ticket = await storage.createTicket({
        shorthand,
        content: initialContent,
        title,
        draft: true,
        parentId,
        userPrompt,
        statusId: (await resolveStatusId(ctx, storage)) ?? null,
        tagIds: await resolveTagIds(ctx, storage),
      });

      const content = templateRecord
        ? renderTemplate(templateRecord.content, {
            TICKET_ID: ticket.shorthand,
            TICKET_TITLE: title,
            CREATED_AT: ticket.createdAt,
            INPUT: userPrompt ?? "",
            PARENT_ID: parentId ?? "",
            USER_PROMPT: userPrompt ?? "",
            STATUS: stringParam(ctx, "status") ?? "backlog",
          })
        : initialContent;
      if (templateRecord) await storage.provider.update(ticket.shorthand, { content });

      const projectRoot = await resolveProjectRoot(ctx);
      const filePath = writeTicketFile(
        projectRoot,
        ticket.shorthand,
        buildLocalTicketContent({
          shorthand: ticket.shorthand,
          createdAt: ticket.createdAt,
          draft: true,
          content,
          parentId,
          userPrompt,
          tags: tagNames,
        }),
      );
      const relativePath = filePath.replace(`${projectRoot}/`, "");
      return isCliRun(ctx) ? `Created ticket ${ticket.shorthand} (draft) at ${relativePath}` : ticket;
    },
  },
} satisfies Record<string, CommandDefinition>;
