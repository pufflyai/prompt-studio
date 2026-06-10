import { defineCommand, params } from "@pstdio/sdk/extensions";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { requireRepoFiles, ticketMarkdownPath, ticketToMarkdown, writeTicketMarkdown } from "../data/draft-storage";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";

// `pst tickets write`: create a draft ticket in extension storage and lay down its
// local `.pstdio/tickets/<shorthand>/ticket.md` via the host file primitive. The
// draft is later reconciled with edits by `pst tickets save`.
export const writeTicketCommand = defineCommand({
  title: "Write draft ticket",
  cli: {
    globalAliases: [["tickets", "write"]],
    examples: ["pstdio tickets write --title 'Fix login' --status Ready --tag High"],
  },
  params: {
    title: params.text({ required: true }),
    status: params.text(),
    tags: params.list(),
    userPrompt: params.text(),
    parent: params.text(),
  },
  async run(ctx) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (ctx.params.tags !== undefined) await seedDefaultTags(ctx.storage);

    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { shorthand, sortOrder } = allocateTicketIdentity(ctx.project.shorthand, existing);

    const statusId =
      ctx.params.status !== undefined
        ? await resolveStatusId(ctx.storage, ctx.params.status)
        : (defaultStatus?.id ?? null);
    const tagIds = ctx.params.tags !== undefined ? await resolveTagOptionIds(ctx.storage, ctx.params.tags) : [];
    const parentId = ctx.params.parent !== undefined ? await resolveTicketId(ctx.storage, ctx.params.parent) : null;

    const ticket = await putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand,
      title: ctx.params.title,
      content: `# ${ctx.params.title}\n`,
      statusId,
      tagIds,
      attachments: [],
      parentId,
      dependsOn: null,
      blockedReason: null,
      userPrompt: ctx.params.userPrompt ?? null,
      parallelizable: null,
      draft: true,
      archived: false,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    await writeTicketMarkdown(repoFiles, ticket, await ticketToMarkdown(ctx.storage, ticket));
    return { shorthand: ticket.shorthand, path: ticketMarkdownPath(ticket.shorthand) };
  },
});
