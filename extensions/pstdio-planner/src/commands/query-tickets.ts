import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { queryTicketPage } from "../data/query-ticket-page";
import { readTicketBoardFields } from "../data/ticket-board-fields";

export const queryTickets = queryTicketPage;

export const queryTicketRenderer = async (
  ctx: Parameters<typeof queryTicketPage>[0],
  input: Partial<KanbanRendererQueryParams> & { fieldsOnly?: true },
) => (input.fieldsOnly ? readTicketBoardFields(ctx) : queryTickets(ctx, input, undefined, input.page?.limit === 0));

export const queryTicketsCommand = defineCommand({
  id: "query-tickets",
  title: "Query tickets",
  params: {
    filter: params.json<KanbanRendererQueryParams["filter"]>(),
    sorts: params.json<KanbanRendererQueryParams["sorts"]>(),
    page: params.json<KanbanRendererQueryParams["page"]>(),
    settings: params.json<KanbanRendererQueryParams["settings"]>(),
  },
  run: (ctx, input) => queryTickets(ctx, input, ctx.signal),
});
