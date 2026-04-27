import { basename } from "node:path";
import type { PlannerTicketWorkflowContext, TicketPushInput } from "../contract";
import { extractDisplayTitle } from "./display-title";
import {
  listTicketArtifacts,
  listTicketFiles,
  readTicketArtifact,
  readTicketAttachment,
  readTicketFile,
  writeTicketFile,
} from "./local-ticket-artifacts";
import { applyFrontmatterValues, parseFrontmatter, stripFrontmatter } from "./ticket-frontmatter";

const uploadLocalTicketFiles = async (ctx: PlannerTicketWorkflowContext, shorthand: string, ticketId: string) => {
  const localFiles = listTicketFiles(ctx.projectRoot, shorthand);

  for (const fileName of localFiles) {
    const content = readTicketAttachment(ctx.projectRoot, shorthand, fileName);
    await ctx.tickets.uploadFile(ticketId, {
      fileName,
      content,
    });
  }

  return localFiles.length;
};

const uploadLocalTicketArtifacts = async (ctx: PlannerTicketWorkflowContext, shorthand: string, ticketId: string) => {
  const localArtifacts = listTicketArtifacts(ctx.projectRoot, shorthand);

  for (const relativePath of localArtifacts) {
    const content = readTicketArtifact(ctx.projectRoot, shorthand, relativePath);
    await ctx.tickets.uploadFile(ticketId, {
      fileName: basename(relativePath),
      relativePath,
      content,
    });
  }

  return localArtifacts.length;
};

const markLocalTicketAsSaved = (content: string) =>
  applyFrontmatterValues(["---", "draft: false", "---"].join("\n"), content);

export const pushLocalTicket = async (ctx: PlannerTicketWorkflowContext, input: TicketPushInput) => {
  const content = readTicketFile(ctx.projectRoot, input.ticketId);
  if (content === null) {
    throw new Error(`Local ticket not found: .pstdio/tickets/${input.ticketId}/ticket.md`);
  }

  const ticket = await ctx.tickets.getByShorthand(input.ticketId);
  if (!ticket) throw new Error(`Ticket not found: ${input.ticketId}`);

  const frontmatter = parseFrontmatter(content);
  const bodyContent = stripFrontmatter(content).replace(/^\n+/, "");
  const tagIds = input.tags?.length ? await ctx.tickets.resolveTagIds(input.tags) : undefined;
  const statusId = input.status ? await ctx.tickets.resolveStatusId(input.status) : undefined;

  await ctx.tickets.update(ticket.id, {
    blockedReason: frontmatter.blockedReason,
    content: bodyContent,
    displayTitle: extractDisplayTitle(bodyContent),
    draft: false,
    parentId: frontmatter.parentId,
    tagIds,
    statusId,
  });

  const uploadedFileCount =
    (await uploadLocalTicketFiles(ctx, input.ticketId, ticket.id)) +
    (await uploadLocalTicketArtifacts(ctx, input.ticketId, ticket.id));
  writeTicketFile(ctx.projectRoot, input.ticketId, markLocalTicketAsSaved(content));

  const messages = [`Saved ticket ${input.ticketId}`];
  if (uploadedFileCount > 0) messages.push(`Uploaded ${uploadedFileCount} ticket files`);

  return {
    ticketId: input.ticketId,
    uploadedFileCount,
    messages,
  };
};
