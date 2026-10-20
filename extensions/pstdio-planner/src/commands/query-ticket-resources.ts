import type { CommandPaletteResourceContribution } from "@pstdio/sdk/extensions";
import { TICKET_ARCHIVE_STATE_ACTIVE, TICKET_ARCHIVE_STATE_ATTRIBUTE_ID, TICKET_RESOURCE_ICON } from "../data/mappers";
import { runTicketsQuery } from "../data/query";
import { ticketPageTarget } from "../data/ticket-page-target";
import { getTicketCommand } from "./get-ticket";

const matchesQuery = (haystack: string, query: string) => {
  const needle = query.trim().toLowerCase();
  return !needle || haystack.toLowerCase().includes(needle);
};

export const queryTicketResources: CommandPaletteResourceContribution["query"] = async (ctx, input) => {
  const query = input.query ?? "";
  const matches = await ctx.resources.findByShorthand({ kind: "ticket", shorthand: query.trim().toUpperCase() });
  const matchedIds = new Set(matches.map(({ id }) => id));
  const { rows } = await runTicketsQuery({
    storage: ctx.storage,
    resources: ctx.resources,
    projectId: ctx.projectId,
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
  });

  const items = rows
    .filter((row) => matchedIds.has(row.id) || matchesQuery(`${row.resource?.shorthand ?? ""} ${row.title}`, query))
    .slice(0, input.limit ?? rows.length)
    .map((row) => ({
      id: row.id,
      label: `${row.resource?.shorthand ?? ""} ${row.title}`.trim(),
      icon: TICKET_RESOURCE_ICON,
      target: row.resource
        ? ticketPageTarget(row.resource)
        : { kind: "command" as const, target: { command: getTicketCommand.ref, params: { id: row.id } } },
    }));

  return { items };
};
