import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { Ticket } from "./types";

type DependencyTicket = Pick<Ticket, "id" | "shorthand" | "dependsOn" | "blockedReason">;

// Recognize only the reported dependency-only sentence. Additional instructions are independent blockers.
export const dependencyBlockerRefs = (reason: string | null | undefined) => {
  const match = /^Complete (.+) before implementing this dependent contract\.$/.exec(reason?.trim() ?? "");
  if (!match) return undefined;
  const refs = match[1]!.split(/,\s*(?:and\s+)?|\s+and\s+/);
  return refs.every((ref) => /^[A-Z][A-Z0-9]*-\d+$/.test(ref)) ? refs : undefined;
};

export const dependencyTicketIndex = <T extends DependencyTicket>(tickets: T[]) =>
  new Map(
    tickets.flatMap((ticket) => [
      [ticket.id.toLowerCase(), ticket],
      [ticket.shorthand.toLowerCase(), ticket],
    ]),
  );

export const dependencyBlockerIds = <T extends DependencyTicket>(ticket: T, byRef: Map<string, T>) => {
  const refs = dependencyBlockerRefs(ticket.blockedReason);
  if (!refs) return undefined;
  const linkedIds = new Set(
    normalizeTicketDependencies(ticket.dependsOn).map((ref) => byRef.get(ref.toLowerCase())?.id),
  );
  const dependencies = refs.map((ref) => byRef.get(ref.toLowerCase()));
  if (dependencies.some((dependency) => !dependency || !linkedIds.has(dependency.id))) return undefined;
  return dependencies.map((dependency) => dependency!.id);
};

export const withIndependentBlockers = <T extends DependencyTicket>(tickets: T[]) => {
  const byRef = dependencyTicketIndex(tickets);
  return tickets.map((ticket) => (dependencyBlockerIds(ticket, byRef) ? { ...ticket, blockedReason: null } : ticket));
};
