import type { PlannerTicketRecord, PlannerTicketWorkflowContext, TicketPullInput } from "../contract";
import { writeTicketAttachment, writeTicketFile } from "./local-ticket-artifacts";
import { applyFrontmatter, buildTicketFrontmatter } from "./ticket-frontmatter";

const isShorthand = (value: string) => /^[A-Za-z]+-\d+$/.test(value);

const resolveParentFrontmatterValue = async (ctx: PlannerTicketWorkflowContext, parentId: string | null) => {
  if (!parentId) return null;
  if (isShorthand(parentId)) return parentId;

  const parentTicket = await ctx.tickets.get(parentId);
  return parentTicket?.shorthand ?? parentId;
};

const pullSingleTicket = async (
  ctx: PlannerTicketWorkflowContext,
  ticket: PlannerTicketRecord,
  input: Required<Pick<TicketPullInput, "force">>,
) => {
  const parentId = await resolveParentFrontmatterValue(ctx, ticket.parentId);
  const frontmatter = buildTicketFrontmatter({
    shorthand: ticket.shorthand,
    createdAt: ticket.createdAt,
    draft: ticket.draft,
    parentId,
    userPrompt: ticket.userPrompt,
    dependsOn: ticket.dependsOn,
    parallelizable: ticket.parallelizable,
    blockedReason: ticket.blockedReason,
    tagNames: ticket.tagNames,
  });

  let bodyContent = "";
  if (ticket.fileId) {
    const fileBuffer = await ctx.tickets.readFileContent(ticket.id, ticket.fileId);
    bodyContent = fileBuffer.toString("utf-8");
  }

  const content = applyFrontmatter(frontmatter, bodyContent);
  const filePath = writeTicketFile(ctx.projectRoot, ticket.shorthand, content, input.force);
  const ticketDir = filePath.replace(/\/ticket\.md$/, "").replace(`${ctx.projectRoot}/`, "");

  const files = await ctx.tickets.listFiles(ticket.id);
  const attachments = files.filter((file) => file.id !== ticket.fileId);

  for (const file of attachments) {
    const fileContent = await ctx.tickets.readFileContent(ticket.id, file.id);
    writeTicketAttachment(ctx.projectRoot, ticket.shorthand, file.fileName, fileContent, input.force);
  }

  const messages = [`Pulled ticket ${ticket.shorthand} to ${ticketDir}`];
  if (attachments.length > 0) messages.push(`Downloaded ${attachments.length} ticket files`);

  return {
    shorthand: ticket.shorthand,
    downloadedFileCount: attachments.length,
    messages,
  };
};

const resolvePullTickets = async (ctx: PlannerTicketWorkflowContext, input: TicketPullInput) => {
  if (!input.ticketId) return ctx.tickets.list({ archived: false });

  const ticket = await ctx.tickets.getByShorthand(input.ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${input.ticketId}`);
  return [ticket];
};

export const pullLocalTickets = async (ctx: PlannerTicketWorkflowContext, input: TicketPullInput) => {
  const tickets = await resolvePullTickets(ctx, input);
  const force = input.force ?? false;

  if (tickets.length === 0) {
    return {
      pulledTicketShorthands: [],
      downloadedFileCount: 0,
      messages: ["No tickets to pull."],
    };
  }

  const results = [];
  for (const ticket of tickets) {
    results.push(await pullSingleTicket(ctx, ticket, { force }));
  }

  const messages = results.flatMap((result) => result.messages);
  if (!input.ticketId) messages.push(`Pulled ${tickets.length} tickets`);

  return {
    pulledTicketShorthands: results.map((result) => result.shorthand),
    downloadedFileCount: results.reduce((total, result) => total + result.downloadedFileCount, 0),
    messages,
  };
};
