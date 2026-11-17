import { findStoredTicket } from "./resolve";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { TicketContext } from "./ticket-identity";
import type { Ticket } from "./types";

type DependencyTicket = Pick<Ticket, "id" | "shorthand" | "statusId" | "dependsOn" | "reviewLinks">;
const dependencyTicket = ({ id, shorthand, statusId, dependsOn, reviewLinks }: Ticket): DependencyTicket => ({
  id,
  shorthand,
  statusId,
  dependsOn,
  reviewLinks,
});

/** Read only the graph reachable from this ticket, including completed prerequisites. */
export const readTicketDependencyClosure = async (ctx: TicketContext, ref: string) => {
  const stored = await findStoredTicket(ctx, ref);
  const selected = stored ? dependencyTicket(stored) : undefined;
  const tickets = new Map<string, DependencyTicket>();
  const seen = new Set<string>();
  const pending = selected ? [selected] : [];
  while (pending.length) {
    const ticket = pending.pop()!;
    if (tickets.has(ticket.id)) continue;
    tickets.set(ticket.id, ticket);
    for (const dependency of normalizeTicketDependencies(ticket.dependsOn)) {
      if (seen.has(dependency) || tickets.has(dependency)) continue;
      seen.add(dependency);
      const stored = await findStoredTicket(ctx, dependency);
      if (stored) pending.push(dependencyTicket(stored));
    }
  }
  return { selected, tickets: [...tickets.values()] };
};
