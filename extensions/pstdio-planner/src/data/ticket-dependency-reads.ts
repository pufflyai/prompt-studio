import { findStoredTicket } from "./resolve";
import { readReviewLinkProjections, reviewLinkProjectionFields } from "./review-link-projections";
import { preparePlannerIndexes } from "./storage-indexes";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { TicketContext } from "./ticket-identity";
import { ticketQuerySummary, ticketSummaryFields } from "./ticket-query-summary";
import type { Ticket } from "./types";

type DependencyTicket = Pick<
  Ticket,
  "id" | "shorthand" | "statusId" | "dependsOn" | "reviewLinks" | "updatedAt" | "blockedReason"
>;
const dependencyTicket = ({
  id,
  shorthand,
  statusId,
  dependsOn,
  reviewLinks,
  updatedAt,
  blockedReason,
}: Ticket): DependencyTicket => ({
  id,
  shorthand,
  statusId,
  dependsOn,
  reviewLinks,
  updatedAt,
  blockedReason,
});

const readDependencySummaries = async (ctx: TicketContext, ids: string[]) => {
  const page = await ctx.storage.records.query({
    index: "ticket-view",
    where: { field: "id", op: "in", value: ids },
    fields: [...ticketSummaryFields, ...reviewLinkProjectionFields, "blockedReason"],
    limit: 100,
    orderBy: [],
  });
  return page.records.flatMap(({ fields }) => {
    const summary = ticketQuerySummary(fields);
    return summary
      ? [
          {
            ...summary,
            reviewLinks: readReviewLinkProjections(fields),
            blockedReason: typeof fields.blockedReason === "string" ? fields.blockedReason : undefined,
          },
        ]
      : [];
  });
};

const readDependencyBatch = async (ctx: TicketContext, refs: string[]) => {
  const records = await readDependencySummaries(ctx, refs);
  const found = new Set(records.map(({ id }) => id));
  const aliases: string[] = [];
  for (const ref of refs)
    if (!found.has(ref)) {
      const matches = await ctx.resources.findByShorthand({ kind: "ticket", shorthand: ref.trim().toUpperCase() });
      if (matches.length > 1) throw new Error(`Ticket "${ref}" matches several tickets. Use a ticket ID.`);
      if (matches[0]) aliases.push(matches[0].id);
    }
  return aliases.length ? [...records, ...(await readDependencySummaries(ctx, [...new Set(aliases)]))] : records;
};

const nextReferences = (pending: DependencyTicket[], tickets: Map<string, DependencyTicket>, seen: Set<string>) => {
  const refs: string[] = [];
  for (const ticket of pending) {
    if (tickets.has(ticket.id)) continue;
    tickets.set(ticket.id, ticket);
    for (const dependency of normalizeTicketDependencies(ticket.dependsOn)) {
      if (seen.has(dependency) || tickets.has(dependency)) continue;
      seen.add(dependency);
      refs.push(dependency);
    }
  }
  return refs;
};

/** Read only the graph reachable from this ticket, including completed prerequisites. */
export const readTicketDependencyClosure = async (ctx: TicketContext, ref: string, selectedTicket?: Ticket) => {
  const stored = selectedTicket ?? (await findStoredTicket(ctx, ref));
  const selected = stored ? dependencyTicket(stored) : undefined;
  const tickets = new Map<string, DependencyTicket>();
  const seen = new Set<string>();
  let pending = selected ? [selected] : [];
  await preparePlannerIndexes(ctx.storage);
  while (pending.length) {
    const refs = nextReferences(pending, tickets, seen);
    pending = [];
    for (let offset = 0; offset < refs.length; offset += 100) {
      pending.push(...(await readDependencyBatch(ctx, refs.slice(offset, offset + 100))));
    }
  }
  return { selected, tickets: [...tickets.values()] };
};
