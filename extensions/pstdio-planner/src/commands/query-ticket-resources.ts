import type { CommandPaletteResourceContribution } from "@pstdio/sdk/extensions";
import { TICKET_RESOURCE_ICON } from "../data/mappers";
import { runTicketsQuery } from "../data/query";
import { getTicketCommand } from "./get-ticket";

const matchesQuery = (haystack: string, query: string) => {
  const needle = query.trim().toLowerCase();
  return !needle || haystack.toLowerCase().includes(needle);
};

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
        : { kind: "command" as const, target: { command: getTicketCommand.ref, params: { id: row.id } } },
    }));

  return { items };
};
