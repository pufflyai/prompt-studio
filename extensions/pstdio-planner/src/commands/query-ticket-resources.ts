import type { CommandPaletteResourceContribution } from "@pstdio/sdk/extensions";
import { TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID, TICKET_RESOURCE_ICON } from "../data/mappers";
import { readTicketViewPage } from "../data/query-ticket-page";
import { ticketPageTarget } from "../data/ticket-page-target";
import { getTicketCommand } from "./get-ticket";

export const queryTicketResources: CommandPaletteResourceContribution["query"] = async (ctx, input) => {
  const query = input.query ?? "";
  const matches = query.trim()
    ? await ctx.resources.findByShorthand({ kind: "ticket", shorthand: query.trim().toUpperCase() })
    : [];
  const {
    result: { rows },
  } = await readTicketViewPage(
    ctx,
    {
      page: { limit: Math.min(input.limit ?? 100, 100), offset: 0, search: "", fields: ["title", "id"] },
      filter: {
        conjunction: "and",
        rules: [
          {
            attributeId: TICKET_ARCHIVE_STATE_ATTRIBUTE_ID,
            condition: "is-any-of",
            value: [TICKET_ARCHIVE_STATE_ACTIVE],
          },
        ],
      },
    },
    {
      where: query.trim()
        ? {
            any: [
              { field: "id", op: "in", value: matches.map(({ id }) => id) },
              { field: "title", op: "textContains", value: query.trim() },
              { field: "shorthand", op: "textContains", value: query.trim() },
            ],
          }
        : undefined,
    },
  );

  const items = rows.map((row) => ({
    id: row.id,
    label: `${row.resource?.shorthand ?? ""} ${row.title}`.trim(),
    icon: TICKET_RESOURCE_ICON,
    target: row.resource
      ? ticketPageTarget(row.resource)
      : { kind: "command" as const, target: { command: getTicketCommand.ref, params: { id: row.id } } },
  }));

  return { items };
};
