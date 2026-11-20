import { preparePlannerIndexes } from "./storage-indexes";
import type { TicketContext } from "./ticket-identity";
import { readTicketPageParents } from "./ticket-page-parents";
import { ticketQuerySummary } from "./ticket-query-summary";
import type { TicketSummary } from "./ticket-summary";

// Opening a body/review page needs identity and hierarchy, not the document or file inventory.
const readOpeningSummariesOnce = async (ctx: TicketContext, ids: string[]) => {
  const byId = new Map<string, TicketSummary>();
  if (!ids.length) return { byId, parentLookup: byId };
  let revision: string | undefined;
  for (let offset = 0; offset < ids.length; offset += 100) {
    const page = await ctx.storage.records.query({
      index: "ticket-view",
      fields: ["id", "shorthand", "title", "parentId", "archived"],
      where: { field: "id", op: "in", value: ids.slice(offset, offset + 100) },
      orderBy: [],
      limit: 100,
      ...(revision ? { revision } : {}),
    });
    revision = page.revision;
    for (const { fields } of page.records) {
      const ticket = ticketQuerySummary(fields);
      if (ticket) byId.set(ticket.id, ticket);
    }
  }
  const parentLookup = await readTicketPageParents(ctx, new Map(ids.map((id) => [id, byId.get(id)])));
  await ctx.storage.records.query({ index: "ticket-view", fields: [], limit: 0, orderBy: [], revision });
  return { byId, parentLookup };
};

// A peer edit can change the owner revision while this finite opening is assembled. Restart once
// from a fresh revision; never return a mixed hierarchy or hide repeated churn/other failures.
export const readTicketOpeningSummaries = async (ctx: TicketContext, ids: string[]) => {
  if (ids.length) await preparePlannerIndexes(ctx.storage);
  try {
    return await readOpeningSummariesOnce(ctx, ids);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Query revision is stale; restart the query") throw error;
    return readOpeningSummariesOnce(ctx, ids);
  }
};
