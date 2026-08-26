import { type CommandPaletteResourceContribution, commandRef } from "@pstdio/sdk/extensions";
import { TICKET_RESOURCE_ICON } from "../data/mappers";
import { runTicketsQuery } from "../data/query";

const matchesQuery = (haystack: string, query: string) => {
  const needle = query.trim().toLowerCase();
  return !needle || haystack.toLowerCase().includes(needle);
};

// Backs the tickets command-palette resource provider: returns matching tickets as
// palette items that open the ticket resource when selected.
const getTicketCommand = commandRef<{ ticket: string }>({
  extensionId: "pstdio.pstdio-planner",
  id: "get-ticket",
});

export const queryTicketResources: CommandPaletteResourceContribution["query"] = async (ctx, input) => {
  const query = input.query ?? "";
  const { rows } = await runTicketsQuery({ storage: ctx.storage, projectId: ctx.projectId });

  const items = rows
    .filter((row) => matchesQuery(row.title, query))
    .slice(0, input.limit ?? rows.length)
    .map((row) => ({
      id: row.id,
      label: row.title,
      icon: TICKET_RESOURCE_ICON,
      target: row.resource
        ? { kind: "resource" as const, resource: row.resource }
        : { kind: "command" as const, target: { command: getTicketCommand, params: { ticket: row.id } } },
    }));

  return { items };
};
