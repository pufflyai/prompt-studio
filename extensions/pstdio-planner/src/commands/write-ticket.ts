import { defineCommand, params } from "@pstdio/sdk/extensions";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "../data/collections";
import { requireRepoFiles, ticketMarkdownPath, ticketToMarkdown, writeTicketMarkdown } from "../data/draft-storage";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";

// `pst tickets write`: create a draft ticket in extension storage and lay down its
// local `.pstdio/tickets/<shorthand>/ticket.md` via the host file primitive. The
// draft is later reconciled with edits by `pst tickets save`.
export const writeTicketCommand = defineCommand({
  id: "write-ticket",
  mutating: true,
  title: "Write draft ticket",
  cli: {
    globalAliases: [["tickets", "write"]],
    examples: ["pstdio tickets write --title 'Fix login' --status TODO --tags High"],
  },
  params: {
    title: params.text({ required: true }),
    status: params.text(),
    tags: params.list(),
    userPrompt: params.text(),
    parent: params.text(),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const existing = await ticketsCollection(ctx.storage).list();
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (commandParams.tags !== undefined) await seedDefaultTags(ctx.storage);

    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { shorthand, sortOrder } = allocateTicketIdentity(ctx.project.shorthand, existing);

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : (defaultStatus?.id ?? null);
    const tagIds = commandParams.tags !== undefined ? await resolveTagOptionIds(ctx.storage, commandParams.tags) : [];
    const parentId =
      commandParams.parent !== undefined ? await resolveTicketId(ctx.storage, commandParams.parent) : null;

    const ticket = await putTicket(ctx.storage, {
      id: crypto.randomUUID(),
      shorthand,
      title: commandParams.title,
      content: `# ${commandParams.title}\n`,
      statusId,
      tagIds,
      attachments: [],
      parentId,
      dependsOn: [],
      blockedReason: null,
      userPrompt: commandParams.userPrompt ?? null,
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
