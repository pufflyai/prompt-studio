import {
  type DataRendererFilterState,
  type DataRendererOrdering,
  type DataRendererRow,
  type DataRendererTagDefinition,
  type FilterCategory,
  type GroupingField,
  isTagKey,
  toTagName,
} from "./types";

interface GroupingOptions {
  columnGrouping: GroupingField;
  rowGrouping: GroupingField;
  knownColumnKeys?: string[];
}

interface DataRendererRowGroup {
  key: string;
  label: string;
  tickets: DataRendererRow[];
}

interface DataRendererColumnGroup {
  key: string;
  label: string;
  tickets: DataRendererRow[];
  rows: DataRendererRowGroup[];
}

const FALLBACK_LABELS: Record<string, string> = {
  status: "No status",
  assignee: "Unassigned",
};

const normalize = (value: string | null | undefined, fallback: string) => {
  if (!value || value.trim() === "") {
    return fallback;
  }

  return value;
};

const getTagValue = (ticket: DataRendererRow, tagName: string) =>
  ticket.tags?.find((tag) => tag.name === tagName)?.value ?? null;

const getGroupingValue = (ticket: DataRendererRow, grouping: GroupingField) => {
  if (grouping === "none") {
    return "All";
  }

  if (grouping === "status") {
    return normalize(ticket.status, FALLBACK_LABELS.status!);
  }

  if (grouping === "assignee") {
    return normalize(ticket.assignee, FALLBACK_LABELS.assignee!);
  }

  if (isTagKey(grouping)) {
    const tagName = toTagName(grouping);
    const fallback = FALLBACK_LABELS[grouping] ?? `No ${tagName}`;
    return normalize(getTagValue(ticket, tagName), fallback);
  }

  return "All";
};

const compareGroupKey = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

const orderByDirection = (value: number, direction: DataRendererOrdering["direction"]) =>
  direction === "asc" ? value : value * -1;

export const orderRows = (
  tickets: DataRendererRow[],
  ordering: DataRendererOrdering,
  tagDefinitions: DataRendererTagDefinition[] = [],
) => {
  if (ordering.field === "manual") {
    return tickets;
  }

  return [...tickets].sort((a, b) => {
    if (ordering.field === "updated") {
      const left = new Date(a.updatedAt ?? 0).getTime();
      const right = new Date(b.updatedAt ?? 0).getTime();
      return orderByDirection(left - right, ordering.direction);
    }

    if (ordering.field === "title") {
      return orderByDirection(a.title.localeCompare(b.title), ordering.direction);
    }

    if (isTagKey(ordering.field)) {
      const tagName = toTagName(ordering.field);
      const def = tagDefinitions.find((d) => d.name === tagName);
      const leftVal = getTagValue(a, tagName);
      const rightVal = getTagValue(b, tagName);

      if (def) {
        const toOptionIndex = (value: string | null) => {
          if (value === null) {
            return def.options.length;
          }

          const index = def.options.findIndex((o) => o.value === value);
          return index === -1 ? def.options.length + 1 : index;
        };

        const leftIndex = toOptionIndex(leftVal);
        const rightIndex = toOptionIndex(rightVal);
        return orderByDirection(leftIndex - rightIndex, ordering.direction);
      }

      return orderByDirection(
        (leftVal ?? "").localeCompare(rightVal ?? "", undefined, { numeric: true }),
        ordering.direction,
      );
    }

    return orderByDirection(a.ticketId.localeCompare(b.ticketId, undefined, { numeric: true }), ordering.direction);
  });
};

export const groupRows = (tickets: DataRendererRow[], options: GroupingOptions): DataRendererColumnGroup[] => {
  const { columnGrouping, rowGrouping, knownColumnKeys } = options;
  const groupedByColumn = new Map<string, DataRendererRow[]>();

  // Seed with known keys so empty columns are preserved
  if (knownColumnKeys) {
    for (const key of knownColumnKeys) {
      groupedByColumn.set(key, []);
    }
  }

  for (const ticket of tickets) {
    const key = getGroupingValue(ticket, columnGrouping);
    groupedByColumn.set(key, [...(groupedByColumn.get(key) ?? []), ticket]);
  }

  const columnEntries = [...groupedByColumn.entries()].sort(([left], [right]) => compareGroupKey(left, right));

  return columnEntries.map(([columnKey, columnTickets]) => {
    if (rowGrouping === "none") {
      return {
        key: columnKey,
        label: columnKey,
        tickets: columnTickets,
        rows: [],
      };
    }

    const groupedByRow = new Map<string, DataRendererRow[]>();

    for (const ticket of columnTickets) {
      const rowKey = getGroupingValue(ticket, rowGrouping);
      groupedByRow.set(rowKey, [...(groupedByRow.get(rowKey) ?? []), ticket]);
    }

    const rows = [...groupedByRow.entries()]
      .sort(([left], [right]) => compareGroupKey(left, right))
      .map(([rowKey, rowTickets]) => ({
        key: rowKey,
        label: rowKey,
        tickets: rowTickets,
      }));

    return {
      key: columnKey,
      label: columnKey,
      tickets: columnTickets,
      rows,
    };
  });
};

const getTicketFilterValues = (ticket: DataRendererRow, category: FilterCategory): string[] => {
  if (category === "status") {
    return [normalize(ticket.status, FALLBACK_LABELS.status!)];
  }

  if (category === "assignee") {
    return [normalize(ticket.assignee, FALLBACK_LABELS.assignee!)];
  }

  if (isTagKey(category)) {
    const tagName = toTagName(category);
    const value = getTagValue(ticket, tagName);
    return value ? [value] : [];
  }

  return [];
};

export const filterRows = (tickets: DataRendererRow[], filters: DataRendererFilterState) => {
  const activeFilters = Object.entries(filters).filter(([, values]) => values && values.length > 0);

  if (activeFilters.length === 0) {
    return tickets;
  }

  return tickets.filter((ticket) =>
    activeFilters.every(([category, values]) => {
      const ticketValues = getTicketFilterValues(ticket, category as FilterCategory);
      return ticketValues.some((value) => values?.includes(value));
    }),
  );
};

export const countFilterValues = (tickets: DataRendererRow[], category: FilterCategory) => {
  const counts: Record<string, number> = {};

  for (const ticket of tickets) {
    for (const value of getTicketFilterValues(ticket, category)) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }

  return counts;
};

export type { DataRendererColumnGroup, DataRendererRowGroup };
