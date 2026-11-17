import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import type { TicketContext } from "./ticket-identity";
import { TICKET_KEY_PREFIX } from "./ticket-record-address";
import { readTicketParentLookup } from "./ticket-resource-hierarchy";
import { ticketSummary } from "./ticket-summary";
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
export const plannerNavigationIndexes = navigationIndexDefinitions.map((index) =>
  index.name === "ticket-review-requests"
    ? { ...index, collection: "planner-review-requests" }
    : { ...index, keyPrefix: TICKET_KEY_PREFIX },
);

export const prepareNavigationQueries = (storage: ExtensionStorageApi) => preparePlannerIndexes(storage);

import { queryTicketNavigationPage } from "./navigation-page";

export { queryTicketNavigationPage } from "./navigation-page";

export const readTicketNavigation = async (ctx: TicketContext, ticket: Ticket) => {
  const [dependencies, children, dependents] = await Promise.all([
    queryTicketNavigationPage(ctx, ticket, "depends-on"),
    queryTicketNavigationPage(ctx, ticket, "sub-tickets"),
    queryTicketNavigationPage(ctx, ticket, "required-by"),
  ]);
  const selected = new Map(
    [ticketSummary(ticket), ...dependencies.tickets, ...children.tickets, ...dependents.tickets].map((item) => [
      item.id,
      item,
    ]),
  );
  const lookup = await readTicketParentLookup(ctx, selected);
  return { tickets: [...lookup.values()], dependencies, children, dependents };
};
