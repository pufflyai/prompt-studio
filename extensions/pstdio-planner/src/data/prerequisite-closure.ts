import { normalizeTicketDependencies, type TicketDependencyValue } from "./ticket-dependencies";

interface DependencyTicket {
  id: string;
  shorthand: string;
  dependsOn?: TicketDependencyValue;
}
export const prerequisiteClosure = <T extends DependencyTicket>(
  target: T,
  byRef: Map<string, T>,
  complete: (ticket: T) => boolean,
) => {
  const unresolved = new Map<string, T>();
  const visited = new Set<string>();
  const visiting = new Set<string>();
  let missing: string | null = null;
  let cycle: string | null = null;
  const visit = (ticket: T) => {
    if (visited.has(ticket.id) || missing || cycle) return;
    if (visiting.has(ticket.id)) {
      cycle = ticket.shorthand;
      return;
    }
    visiting.add(ticket.id);
    for (const ref of normalizeTicketDependencies(ticket.dependsOn)) {
      const dependency = byRef.get(ref);
      if (!dependency) {
        missing = ref;
        break;
      }
      if (visiting.has(dependency.id)) {
        cycle = dependency.shorthand;
        break;
      }
      if (complete(dependency)) continue;
      visit(dependency);
      unresolved.set(dependency.id, dependency);
    }
    visiting.delete(ticket.id);
    visited.add(ticket.id);
  };
  visit(target);
  return { tickets: [...unresolved.values()], missing, cycle };
};
