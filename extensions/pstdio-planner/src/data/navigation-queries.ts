import type { ExtensionStorageApi, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "./collections";
import { normalizeTicketDependencies } from "./ticket-dependencies";
import type { TicketContext } from "./ticket-identity";
import { readTicketParentLookup } from "./ticket-resource-hierarchy";
import { type TicketSummary, ticketSummary } from "./ticket-summary";
import type { Ticket } from "./types";

const ticketFields: StorageRecordIndex["fields"] = {
  id: { path: ["id"], type: "string" },
  archived: { path: ["archived"], type: "boolean" },
  parentId: { path: ["parentId"], type: "string" },
};

// Collection payloads are the value of their saved record. These projections contain
// only navigation fields; ticket bodies and attachments never enter a query result.
const navigationIndexDefinitions: StorageRecordIndex[] = [
  { name: "ticket-children", fields: ticketFields, equality: ["parentId", "archived"] },
  { name: "ticket-dependents", fields: { ...ticketFields, dependsOn: { path: ["dependsOn"], type: "array" } } },
  {
    name: "ticket-legacy-dependents",
    fields: { ...ticketFields, dependency: { path: ["dependsOn"], type: "string" } },
    equality: ["dependency", "archived"],
  },
  {
    name: "ticket-review-requests",
    fields: {
      ticketId: { path: ["ticketId"], type: "string" },
    },
    equality: ["ticketId"],
  },
];
export const plannerNavigationIndexes = navigationIndexDefinitions.map((index) => ({
  ...index,
  collection: index.name === "ticket-review-requests" ? "planner-review-requests" : "tickets",
}));

export const prepareNavigationQueries = (storage: ExtensionStorageApi) =>
  storage.records.defineIndexes(plannerNavigationIndexes);

export const queryTicketNavigationPage = async (
  ctx: TicketContext,
  ticket: Ticket,
  section: "sub-tickets" | "required-by",
  cursor?: string,
) => {
  await prepareNavigationQueries(ctx.storage);
  const state: { legacy?: boolean; cursor?: string } =
    section === "required-by" && cursor ? JSON.parse(cursor) : { cursor };
  const refs = [ticket.id, ticket.shorthand];
  const query = (legacy: boolean, pageCursor?: string, limit = 100) => {
    let index = "ticket-dependents";
    if (section === "sub-tickets") index = "ticket-children";
    else if (legacy) index = "ticket-legacy-dependents";
    let relation: StoragePredicate;
    if (section === "sub-tickets") relation = { field: "parentId", op: "eq", value: ticket.id };
    else if (legacy) relation = { field: "dependency", op: "in", value: refs };
    else relation = { any: refs.map((value) => ({ field: "dependsOn", op: "contains", value })) };
    return ctx.storage.records.query({
      index,
      where: { all: [{ field: "archived", op: "eq", value: false }, relation] },
      fields: ["id"],
      limit,
      ...(pageCursor ? { cursor: pageCursor } : {}),
    });
  };
  // Keep array membership and legacy scalar equality in separate indexed queries.
  // Combining both in one OR prevents Postgres using either selective index.
  let legacy = state.legacy === true;
  let page = await query(legacy, state.cursor);
  if (section === "required-by" && !legacy && page.records.length < 100 && !page.cursor) {
    legacy = true;
    const rest = await query(true, undefined, 100 - page.records.length);
    page = { ...rest, records: [...page.records, ...rest.records] };
  }
  let nextCursor = page.cursor ?? undefined;
  if (section === "required-by") {
    if (page.cursor) nextCursor = JSON.stringify({ legacy, cursor: page.cursor });
    else if (!legacy) nextCursor = JSON.stringify({ legacy: true });
  }
  // Titles derive from canonical synced content, so read the selected page's
  // tickets through the normal reader, then release their bodies immediately.
  const selected = await ticketsCollection(ctx).getMany(page.records.map(({ fields }) => String(fields.id)));
  return { tickets: selected.flatMap((ticket) => (ticket ? [ticketSummary(ticket)] : [])), nextCursor };
};

export const readTicketNavigation = async (ctx: TicketContext, ticket: Ticket) => {
  const collection = ticketsCollection(ctx);
  const dependencies: TicketSummary[] = [];
  const ids = normalizeTicketDependencies(ticket.dependsOn);
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const values = await collection.getMany(batch);
    // Older records can name a dependency by shorthand instead of stored ID.
    for (const [index, value] of values.entries()) {
      if (value) dependencies.push(ticketSummary(value));
      else {
        const matches = await ctx.resources.findByShorthand({ kind: "ticket", shorthand: batch[index] });
        for (const match of matches) {
          const resolved = await collection.get(match.id);
          if (resolved) dependencies.push(ticketSummary(resolved));
        }
      }
    }
  }
  const [children, dependents] = await Promise.all([
    queryTicketNavigationPage(ctx, ticket, "sub-tickets"),
    queryTicketNavigationPage(ctx, ticket, "required-by"),
  ]);
  const selected = new Map(
    [ticketSummary(ticket), ...dependencies, ...children.tickets, ...dependents.tickets].map((item) => [item.id, item]),
  );
  const lookup = await readTicketParentLookup(ctx, selected);
  return { tickets: [...lookup.values()], children, dependents };
};
