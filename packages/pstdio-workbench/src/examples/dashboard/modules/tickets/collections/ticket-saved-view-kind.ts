import type { FilterExpression, SavedViewField, SavedViewKindContribution } from "../../../../../core";
import { validateSavedViewFilterAgainstFields } from "../../../../../core";
import { dashboardStatusColumns, dashboardTickets, dashboardTicketTags } from "../../../shared/mock-data/tickets";
import { createSavedViewResource } from "./saved-view-resources";
import { filtersToExpression, settingsToDisplay } from "./ticket-view-mapping";

type DashboardTicket = (typeof dashboardTickets)[number];

const getTicketValues = (ticket: DashboardTicket, field: string) => {
  if (field === "status") return ticket.status ? [ticket.status] : [];
  if (field === "assignee") return ticket.assignee ? [ticket.assignee] : [];
  if (field.startsWith("tag:")) {
    const tag = ticket.tags.find((candidate) => candidate.name === field.slice(4));
    return tag ? [tag.value] : [];
  }
  return [];
};

const matchesPredicate = (ticket: DashboardTicket, filter: Exclude<FilterExpression, { op: "and" | "or" }>) => {
  const values = getTicketValues(ticket, filter.field);
  const expected = Array.isArray(filter.value) ? filter.value : [filter.value];

  if (filter.operator === "is") return values.includes(String(filter.value));
  if (filter.operator === "isNot") return !values.includes(String(filter.value));
  if (filter.operator === "in") return expected.some((value) => values.includes(String(value)));
  if (filter.operator === "notIn") return expected.every((value) => !values.includes(String(value)));
  if (filter.operator === "isEmpty") return values.length === 0;
  if (filter.operator === "isNotEmpty") return values.length > 0;
  return true;
};

const matchesFilter = (ticket: DashboardTicket, filter: FilterExpression): boolean => {
  if ("op" in filter) {
    if (filter.op === "and") return filter.children.every((child) => matchesFilter(ticket, child));
    return filter.children.some((child) => matchesFilter(ticket, child));
  }

  return matchesPredicate(ticket, filter);
};

const ticketSavedViewFields = [
  { id: "id", label: "ID", type: "string", operators: ["is", "in", "contains"] },
  { id: "ticketId", label: "Ticket ID", type: "string", operators: ["is", "in", "contains"] },
  { id: "title", label: "Title", type: "string", operators: ["is", "isNot", "contains"] },
  { id: "updated", label: "Updated", type: "date", operators: ["before", "after", "within"] },
  {
    id: "status",
    label: "Status",
    type: "enum",
    operators: ["is", "isNot", "in", "notIn"],
    options: dashboardStatusColumns.map((column) => ({ value: column.id, label: column.label })),
  },
  { id: "assignee", label: "Assignee", type: "user", operators: ["is", "in", "isEmpty", "isNotEmpty"] },
  ...dashboardTicketTags.map((tag) => ({
    id: `tag:${tag.name}`,
    label: tag.label,
    type: "enum" as const,
    operators: ["is", "in"] as const,
    options: tag.options.map((option) => ({ value: option.value, label: option.label })),
  })),
] satisfies readonly SavedViewField[];

export const createTicketSavedViewKind = () =>
  ({
    kind: "ticket",
    label: "Ticket view",
    icon: "Ticket",
    fields: ticketSavedViewFields,
    layouts: ["table", "list", "board"],
    defaultFilter: filtersToExpression({}),
    defaultDisplay: settingsToDisplay({
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { field: "updated", direction: "desc" },
      displayProperties: ["id", "status", "updated"],
    }),
    validateFilter(filter) {
      return validateSavedViewFilterAgainstFields(filter, this.fields);
    },
    async resolveQuery({ filter }) {
      return { rows: dashboardTickets.filter((ticket) => matchesFilter(ticket, filter)) };
    },
    createResource: createSavedViewResource,
  }) satisfies SavedViewKindContribution;
