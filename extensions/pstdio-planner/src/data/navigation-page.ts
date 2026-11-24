import type { StoragePredicate } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { TicketContext } from "./ticket-identity";
import { ticketQuerySummary, ticketSummaryFields } from "./ticket-query-summary";
import type { Ticket } from "./types";

export const queryTicketNavigationPage = async (
  ctx: TicketContext,
  ticket: Ticket,
  section: "sub-tickets" | "required-by" | "depends-on",
  cursor?: string,
) => {
  await preparePlannerIndexes(ctx.storage);
  const refs = [...new Set(normalizeTicketDependencies(ticket.dependsOn).flatMap((ref) => [ref, ref.toUpperCase()]))];
  const sourceRefs = [ticket.id, ticket.shorthand, ...(ticket.aliases ?? [])];
  let relation: StoragePredicate = {
    any: [
      { field: "id", op: "in", value: refs },
      { field: "shorthand", op: "in", value: refs },
      { field: "aliases", op: "overlaps", value: refs },
    ],
  };
  if (section === "sub-tickets") relation = { field: "parentId", op: "eq", value: ticket.id };
  if (section === "required-by") relation = { field: "dependsOn", op: "overlaps", value: sourceRefs };
  const page = await ctx.storage.records.query({
    index: "ticket-view",
    fields: ticketSummaryFields,
    limit: 100,
    cursor,
    where: section === "depends-on" ? relation : { all: [{ field: "archived", op: "ne", value: true }, relation] },
    orderBy: [{ field: "position", direction: "asc" }],
  });
  return {
    tickets: page.records.flatMap(({ fields }) => {
      const ticket = ticketQuerySummary(fields);
      return ticket ? [ticket] : [];
    }),
    nextCursor: page.cursor ?? undefined,
  };
};
