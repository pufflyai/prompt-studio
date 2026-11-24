import type { CommandPaletteResourceContribution, StoragePredicate } from "@pstdio/sdk/extensions";
import { TICKET_RESOURCE_ICON } from "../data/mappers";
import { readTicketViewPage } from "../data/query-ticket-page";
import { ticketPageTarget } from "../data/ticket-page-target";
import { activeTicket } from "../data/ticket-view-state";

const contains = (field: string, value: string) => ({ field, op: "textContains" as const, value });

export const queryTicketResources: CommandPaletteResourceContribution["query"] = async (ctx, input) => {
  const query = (input.query ?? "").trim().toLowerCase();
  const matches = query ? await ctx.resources.findByShorthand({ kind: "ticket", shorthand: query.toUpperCase() }) : [];
  const matchedIds = matches.map(({ id }) => id);
  const [prefix, suffix] = query.split(/ (.*)/s);
  const any: StoragePredicate[] = [
    contains("title", query),
    contains("shorthand", query),
    { field: "id", op: "in", value: matchedIds },
  ];
  if (suffix !== undefined) any.push({ all: [contains("shorthand", prefix), contains("title", suffix)] });
  const limit = Math.min(input.limit ?? 100, 100);
  const items = [];
  let cursor: string | undefined, revision: string | undefined;
  while (items.length < limit) {
    const page = { limit, offset: 0, cursor, revision, search: "", fields: ["title", "id"] };
    const { result } = await readTicketViewPage(ctx, { page }, { where: { all: [activeTicket, { any }] } });
    // Candidate pages stay bounded; the exact displayed-label match precedes the output limit.
    for (const row of result.rows) {
      const label = `${row.resource.shorthand ?? ""} ${row.title}`.trim();
      if (!matchedIds.includes(row.id) && !label.toLowerCase().includes(query)) continue;
      items.push({ id: row.id, label, icon: TICKET_RESOURCE_ICON, target: ticketPageTarget(row.resource) });
      if (items.length === limit) break;
    }
    if (!result.page.cursor) break;
    cursor = result.page.cursor;
    revision = result.page.revision;
  }
  return { items };
};
