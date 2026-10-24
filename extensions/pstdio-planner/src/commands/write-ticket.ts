import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "../data/collections";
import {
  requireTicketDraftFiles,
  ticketMarkdownPath,
  ticketToMarkdown,
  writeTicketMarkdown,
} from "../data/draft-storage";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { ticketTagsForIds } from "../data/tag-cardinality";
import { allocateTicketIdentity } from "../data/ticket-identity";
import { withTicketOrder } from "../data/ticket-order";

// `pst tickets write`: create a draft ticket in extension storage and lay down its
// local `.pstdio/extension-storage/pstdio-planner/tickets/<shorthand>/ticket.md` via the host file primitive. The
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
    const { projectFiles, resolvePath } = await requireTicketDraftFiles(ctx);
    const statuses = await seedDefaultStatuses(ctx.storage);
    if (commandParams.tags !== undefined) await seedDefaultTags(ctx.storage);

    const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
    const now = new Date().toISOString();
    const { id } = await allocateTicketIdentity(ctx);

    const statusId =
      commandParams.status !== undefined
        ? await resolveStatusId(ctx.storage, commandParams.status)
        : (defaultStatus?.id ?? null);
    const tagIds = commandParams.tags !== undefined ? await resolveTagOptionIds(ctx.storage, commandParams.tags) : [];
    const tags = await ticketTagsForIds(ctx.storage, tagIds);
    const parentId = commandParams.parent !== undefined ? await resolveTicketId(ctx, commandParams.parent) : null;

    const ticket = await withTicketOrder(ctx, async () => {
      const existing = await ticketsCollection(ctx).list();
      const sortOrder = Math.max(-1, ...existing.map((ticket) => ticket.sortOrder)) + 1;
      return putTicket(ctx, {
        id,
        title: commandParams.title,
        content: `# ${commandParams.title}\n`,
        statusId,
        tags,
        attachments: [],
        parentId,
        dependsOn: [],
        blockedReason: null,
        userPrompt: commandParams.userPrompt ?? null,
        draft: true,
        archived: false,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    });

    await writeTicketMarkdown(projectFiles, ticket, await ticketToMarkdown(ctx, ticket));
    return { shorthand: ticket.shorthand, path: resolvePath(ticketMarkdownPath(ticket.shorthand)) };
  },
});
