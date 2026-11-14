import { ticketsCollection } from "./collections";
import type { TicketContext } from "./ticket-identity";
import type { Ticket } from "./types";

export type TicketDependencyValue = string | string[] | null | undefined;

export const normalizeTicketDependencies = (value: TicketDependencyValue) => {
  const values = value ? [value].flat() : [];
  return values.map((id) => id.trim()).filter((id) => id.length > 0 && id !== "[]");
};

export const validateTicketDependencies = async (ctx: TicketContext, ticket: Ticket, dependsOn: string[]) => {
  if (dependsOn.length === 0) return;
  const pending = [...dependsOn];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === ticket.id) throw new Error(`Dependencies for ${ticket.shorthand} would create a dependency cycle`);
    if (visited.has(id)) continue;
    visited.add(id);
    const stored = await ticketsCollection(ctx).get(id);
    pending.push(...normalizeTicketDependencies(stored?.dependsOn));
  }
};
