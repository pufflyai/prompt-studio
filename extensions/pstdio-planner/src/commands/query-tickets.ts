import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { queryTicketPage } from "../data/query-ticket-page";

export const queryTickets = queryTicketPage;

export const queryTicketsCommand = defineCommand({
  id: "query-tickets",
  title: "Query tickets",
  params: {
    filter: params.json<KanbanRendererQueryParams["filter"]>(),
    sorts: params.json<KanbanRendererQueryParams["sorts"]>(),
    page: params.json<KanbanRendererQueryParams["page"]>(),
    settings: params.json<KanbanRendererQueryParams["settings"]>(),
  },
  run: queryTickets,
});
