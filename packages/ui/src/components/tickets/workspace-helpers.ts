import type { TicketCardBadge, TicketCardTagBadge } from "./ticket-card";
import type {
  DisplayProperty,
  FilterCategory,
  FilterState,
  GroupingField,
  OrderingField,
  WorkspaceFilterCategory,
  WorkspaceOption,
  WorkspaceTagDefinition,
  WorkspaceTicket,
} from "./types";
import { isTagKey, toTagName } from "./types";

export const toTitleCase = (value: string) =>
  value
    .replaceAll("_", " ")
    .split(" ")
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0]!.toUpperCase() + chunk.slice(1))
    .join(" ");

const collectCategoryOptions = (tickets: WorkspaceTicket[], category: FilterCategory) => {
  const values = new Set<string>();

  for (const ticket of tickets) {
    if (category === "status") {
      if (ticket.status) values.add(ticket.status);
    } else if (category === "assignee") {
      if (ticket.assignee) values.add(ticket.assignee);
    } else if (isTagKey(category)) {
      const tagName = toTagName(category);
      const tag = ticket.tags?.find((t) => t.name === tagName);
      if (tag) values.add(tag.value);
    }
  }

  return [...values]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((value) => ({ value, label: toTitleCase(value) }));
};

export const buildDefaultFilterCategories = (
  tickets: WorkspaceTicket[],
  tagDefinitions: WorkspaceTagDefinition[],
): WorkspaceFilterCategory[] => {
  const categories: WorkspaceFilterCategory[] = [
    { id: "status", label: "Status", options: collectCategoryOptions(tickets, "status") },
    { id: "assignee", label: "Assignee", options: collectCategoryOptions(tickets, "assignee") },
  ];

  for (const def of tagDefinitions) {
    const categoryId = `tag:${def.name}` as FilterCategory;
    categories.push({
      id: categoryId,
      label: def.label,
      options: def.options.map((o) => ({ value: o.value, label: o.label })),
    });
  }

  return categories;
};

export const toBadges = (ticket: WorkspaceTicket, displayProperties: DisplayProperty[]): TicketCardBadge[] => {
  const badges: TicketCardBadge[] = [];
  const includes = (property: DisplayProperty) => displayProperties.includes(property);

  if (includes("status") && ticket.status) {
    badges.push({ label: ticket.status, color: ticket.statusColor ?? "gray" });
  }

  if (includes("assignee") && ticket.assignee) {
    badges.push({ label: ticket.assignee, color: "blue" });
  }

  if (includes("updated") && ticket.updatedAt) {
    badges.push({ label: new Date(ticket.updatedAt).toLocaleDateString(), color: "gray" });
  }

  return badges;
};

export const toTagBadges = (
  ticket: WorkspaceTicket,
  displayProperties: DisplayProperty[],
  tagDefinitions: WorkspaceTagDefinition[],
): TicketCardTagBadge[] => {
  const tagBadges: TicketCardTagBadge[] = [];

  for (const def of tagDefinitions) {
    const displayKey = `tag:${def.name}` as DisplayProperty;
    if (!displayProperties.includes(displayKey)) continue;

    const tag = ticket.tags?.find((t) => t.name === def.name);
    const optionDef = tag ? def.options.find((o) => o.value === tag.value) : undefined;

    tagBadges.push({
      tagName: def.name,
      label: def.label,
      value: tag?.value ?? null,
      color: optionDef?.color ?? "purple",
      options: def.options,
    });
  }

  return tagBadges;
};

export const buildTagOptions = (tagDefinitions: WorkspaceTagDefinition[]) => ({
  grouping: tagDefinitions.map(
    (def) => ({ value: `tag:${def.name}`, label: def.label }) as WorkspaceOption<GroupingField>,
  ),
  ordering: tagDefinitions.map(
    (def) => ({ value: `tag:${def.name}`, label: def.label }) as WorkspaceOption<OrderingField>,
  ),
  display: tagDefinitions.map(
    (def) => ({ value: `tag:${def.name}`, label: def.label }) as WorkspaceOption<DisplayProperty>,
  ),
});

export const resolveKnownColumnKeys = (
  columnGrouping: GroupingField,
  knownColumnKeys: string[] | undefined,
  categories: WorkspaceFilterCategory[],
) => {
  if (columnGrouping === "none") {
    return undefined;
  }

  if (columnGrouping === "status") {
    if (knownColumnKeys) {
      return knownColumnKeys;
    }
  }

  return categories.find((category) => category.id === columnGrouping)?.options.map((option) => option.value);
};

export const omitFilterCategory = (filters: FilterState, category: FilterCategory): FilterState => {
  const next = { ...filters } as Record<string, string[] | undefined>;
  delete next[category];
  return next as FilterState;
};
