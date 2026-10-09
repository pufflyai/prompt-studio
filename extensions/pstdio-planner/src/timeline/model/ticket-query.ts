// Apply local search and Planner property filters to the timeline's ticket rows.
import type { PlanRow, PlanTag } from "../contracts";

export interface TicketQuery {
  search: string;
  filters: Record<string, string[]>;
  tags: PlanTag[];
}

export function ticketFilterValues(row: PlanRow, tags: PlanTag[]) {
  return {
    status: [row.status],
    milestone: [row.deadlineId ?? "none"],
    ...Object.fromEntries(
      tags.map((tag) => [tag.id, row.tagIds.filter((id) => tag.options.some((option) => option.id === id))]),
    ),
  };
}

export function matchesTicketQuery(row: PlanRow, query: TicketQuery) {
  const search = query.search.trim().toLowerCase();
  if (search && !`${row.shorthand} ${row.title}`.toLowerCase().includes(search)) {
    return false;
  }

  const values: Record<string, string[]> = ticketFilterValues(row, query.tags);
  return Object.entries(query.filters).every(
    ([id, selected]) => !selected.length || selected.some((value) => values[id]?.includes(value)),
  );
}
