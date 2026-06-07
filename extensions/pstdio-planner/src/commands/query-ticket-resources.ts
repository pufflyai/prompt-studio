import { defineCommand } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";

const matchesQuery = (haystack: string, query: string) => {
  const needle = query.trim().toLowerCase();
  return !needle || haystack.toLowerCase().includes(needle);
};

// Backs the tickets command-palette resource provider: returns matching tickets as
// palette items that open the ticket resource when selected.
export const queryTicketResourcesCommand = defineCommand({
  title: "Query ticket palette resources",
  async run(ctx) {
    const params = ctx.params as { query?: string; limit?: number };
    const query = params.query ?? "";
    const { rows } = await runTicketsQuery({ storage: ctx.storage, projectId: ctx.projectId });

    const items = rows
      .filter((row) => matchesQuery(row.title, query))
      .slice(0, params.limit ?? rows.length)
      .map((row) => ({
        id: row.id,
        label: row.title,
        target: row.resource
          ? { kind: "resource" as const, resource: row.resource }
          : { kind: "command" as const, command: "pstdio-planner.get-ticket", params: { ticket: row.id } },
      }));

    return { items };
  },
});
