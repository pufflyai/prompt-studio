import { defineCommand, params } from "@pstdio/sdk/extensions";
import { statusesCollection, tagsCollection, ticketsCollection } from "../data/collections";
import { resolveStatusId, resolveTagOptionIds, resolveTicketId } from "../data/resolve";
import { sortedBySortOrder } from "../utils/sort";

// Backs `pst tickets list`. Status/tag/parent filters accept human names
// (Decision 3); the result is curated display rows so the router renders a tidy
// table. `--parent` doubles as the "sub-tickets of X" query.
export const listTicketsCommand = defineCommand({
  title: "List tickets",
  cli: {
    globalAliases: [["tickets", "list"]],
    examples: ["pstdio tickets list --status 'In Progress' --tags High"],
  },
  params: {
    status: params.text(),
    tags: params.list(),
    archived: params.boolean(),
    draft: params.boolean(),
    parent: params.text(),
  },
  async run(ctx, commandParams) {
    const [tickets, statuses, tags] = await Promise.all([
      ticketsCollection(ctx.storage).list(),
      statusesCollection(ctx.storage).list(),
      tagsCollection(ctx.storage).list(),
    ]);

    const statusNameById = new Map(statuses.map((status) => [status.id, status.name]));
    const optionNameById = new Map(tags.flatMap((tag) => tag.options).map((option) => [option.id, option.name]));

    const statusId = commandParams.status ? await resolveStatusId(ctx.storage, commandParams.status) : undefined;
    const tagIds = commandParams.tags?.length ? await resolveTagOptionIds(ctx.storage, commandParams.tags) : undefined;
    const parentId = commandParams.parent ? await resolveTicketId(ctx.storage, commandParams.parent) : undefined;

    // Drafts and archived tickets are hidden by default, matching the legacy
    // `tickets list`; --draft / --archived select that subset instead.
    const archivedFilter = commandParams.archived ?? false;
    const draftFilter = commandParams.draft ?? false;

    return sortedBySortOrder(
      tickets.filter((ticket) => {
        if (statusId !== undefined && ticket.statusId !== statusId) return false;
        if (tagIds && !tagIds.every((id) => (ticket.tagIds ?? []).includes(id))) return false;
        if (parentId !== undefined && ticket.parentId !== parentId) return false;
        if (Boolean(ticket.archived) !== archivedFilter) return false;
        if (Boolean(ticket.draft) !== draftFilter) return false;
        return true;
      }),
    ).map((ticket) => ({
      shorthand: ticket.shorthand,
      title: ticket.title,
      status: ticket.statusId ? (statusNameById.get(ticket.statusId) ?? "") : "",
      tags: (ticket.tagIds ?? []).map((id) => optionNameById.get(id) ?? id),
    }));
  },
});
