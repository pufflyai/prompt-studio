import { preparePlannerIndexes } from "./storage-indexes";
import type { TicketContext } from "./ticket-identity";
import { ticketQuerySummary, ticketSummaryFields } from "./ticket-query-summary";
import type { TicketParentLookup } from "./ticket-resource-hierarchy";
import { type TicketSummary, ticketSummary } from "./ticket-summary";

export const readTicketPageParents = async (
  ctx: TicketContext,
  selected: ReadonlyMap<string, TicketSummary | undefined>,
) => {
  const lookup: TicketParentLookup = new Map(
    [...selected].flatMap(([id, ticket]) => (ticket ? [[id, ticketSummary(ticket)]] : [])),
  );
  const visited = new Set(selected.keys());
  let pending = [...lookup.values()];
  let prepared = false;
  while (pending.length > 0) {
    const ids = new Set(
      pending.flatMap((ticket) => (ticket.parentId && !visited.has(ticket.parentId) ? [ticket.parentId] : [])),
    );
    // Missing parents are visited too, so another branch cannot fetch them again.
    for (const id of ids) visited.add(id);
    pending = [];
    const keys = [...ids];
    if (keys.length && !prepared) {
      await preparePlannerIndexes(ctx.storage);
      prepared = true;
    }
    for (let offset = 0; offset < keys.length; offset += 100) {
      const page = await ctx.storage.records.query({
        index: "ticket-view",
        where: { field: "id", op: "in", value: keys.slice(offset, offset + 100) },
        fields: ticketSummaryFields,
        limit: 100,
      });
      for (const row of page.records) {
        const summary = ticketQuerySummary(row.fields);
        if (summary) pending.push(summary);
      }
    }
    for (const ticket of pending) lookup.set(ticket.id, ticket);
  }
  return lookup;
};
