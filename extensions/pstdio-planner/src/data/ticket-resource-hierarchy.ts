import type { JsonObject } from "@pstdio/sdk/extensions";
import { type TicketContext, withTicketIdentities } from "./ticket-identity";
import { ticketRecords } from "./ticket-records";
import { type TicketSummary, ticketSummary } from "./ticket-summary";

export type TicketParentLookup = Map<string, TicketSummary>;

export const readTicketParentLookup = async (
  ctx: TicketContext,
  selected: ReadonlyMap<string, TicketSummary | undefined>,
) => {
  const lookup: TicketParentLookup = new Map(
    [...selected].flatMap(([id, ticket]) => (ticket ? [[id, ticketSummary(ticket)]] : [])),
  );
  const visited = new Set(selected.keys());
  let pending = [...lookup.values()];
  const collection = ticketRecords(ctx.storage);
  while (pending.length > 0) {
    const ids = new Set(
      pending.flatMap((ticket) => (ticket.parentId && !visited.has(ticket.parentId) ? [ticket.parentId] : [])),
    );
    // Missing parents are visited too, so another branch cannot fetch them again.
    for (const id of ids) visited.add(id);
    const ancestors = await Promise.all([...ids].map((id) => collection.get(id)));
    pending = (await withTicketIdentities(ctx, ancestors.filter((ticket) => ticket !== undefined))).map(ticketSummary);
    for (const ticket of pending) lookup.set(ticket.id, ticket);
  }
  return lookup;
};

export interface TicketResourceReference extends JsonObject {
  type: "ticket";
  id: string;
  label: string;
  shorthand: string;
  metadata: JsonObject;
}

export const ticketDisplayTitle = (ticket: TicketSummary) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

const ticketsBrowseRootReference = (): JsonObject => ({
  type: "view",
  viewId: "pstdio.pstdio-planner.view.tickets",
});

const createTicketResourceIdentity = (lineage: TicketSummary[], index: number): TicketResourceReference => {
  const ticket = lineage[index];
  const metadata: JsonObject = {
    resourceParent: index > 0 ? createTicketResourceIdentity(lineage, index - 1) : ticketsBrowseRootReference(),
  };

  return {
    type: "ticket",
    id: ticket.id,
    shorthand: ticket.shorthand,
    label: ticketDisplayTitle(ticket),
    metadata,
  };
};

export const resolveTicketHierarchy = (ticket: TicketSummary, parentLookup: TicketParentLookup = new Map()) => {
  const lineage = [];
  const visitedTicketIds = new Set<string>();
  let current: TicketSummary | undefined = ticket;

  while (current && !visitedTicketIds.has(current.id)) {
    lineage.push(current);
    visitedTicketIds.add(current.id);
    current = current.parentId ? parentLookup.get(current.parentId) : undefined;
  }

  lineage.reverse();
  const identity = createTicketResourceIdentity(lineage, lineage.length - 1);
  // Menus read the state of the open or clicked ticket. When expressions only match
  // equal values, so the state is always present.
  const resourceReference: TicketResourceReference = {
    ...identity,
    metadata: { archived: ticket.archived === true, ...identity.metadata },
  };

  return {
    lineage,
    breadcrumb: lineage.map(({ shorthand }) => shorthand).join(" / "),
    parent: lineage[lineage.length - 2],
    identity,
    resourceReference,
  };
};

export const ticketResourceReference = (ticket: TicketSummary, parentLookup: TicketParentLookup = new Map()) =>
  resolveTicketHierarchy(ticket, parentLookup).resourceReference;

// Stored links (session and workspace anchors) keep only the ticket's identity and
// ancestry. Its state would go stale in the copy.
export const ticketResourceIdentity = (ticket: TicketSummary, parentLookup: TicketParentLookup = new Map()) =>
  resolveTicketHierarchy(ticket, parentLookup).identity;

export const linkedResourceParentMetadata = (ticket: TicketSummary, parentLookup: TicketParentLookup = new Map()) => ({
  resourceParent: ticketResourceIdentity(ticket, parentLookup),
});
