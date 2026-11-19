import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { queryTicketPage } from "../data/query-ticket-page";
import { readTicketBoardFields } from "../data/ticket-board-fields";

export const queryTickets = async (
  ctx: Parameters<typeof queryTicketPage>[0],
  input: Partial<KanbanRendererQueryParams> & { fieldsOnly?: true },
) => (input.fieldsOnly ? readTicketBoardFields(ctx) : queryTicketPage(ctx, input));

export const queryTicketRenderer = async (
  ctx: Parameters<typeof queryTicketPage>[0],
  input: Partial<KanbanRendererQueryParams> & { fieldsOnly?: true },
) => (input.fieldsOnly ? readTicketBoardFields(ctx) : queryTickets(ctx, input));

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
