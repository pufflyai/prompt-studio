import { defineExtension, definePage, defineStatuses, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const workflow = defineStatuses({
  id: "workflow",
  title: "Ticket workflow",
  query: async () => ({
    statuses: [
      { id: "todo", label: "To do", color: "gray", sortOrder: 0, isDefault: true },
      { id: "doing", label: "Doing", color: "blue", sortOrder: 1 },
      { id: "done", label: "Done", color: "green", sortOrder: 2 },
    ],
  }),
});
const tickets = defineView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "kanban",
    attributes: [
      {
        id: "status",
        label: "Status",
        type: { kind: "status", statuses: workflow.ref },
        groupable: true,
        displayable: true,
      },
    ],
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      ordering: { attributeId: "status", direction: "asc" },
      displayProperties: [],
    },
    query: async () => ({
      rows: [
        { id: "one", title: "Write the guide", attributes: { status: "doing" } },
        { id: "two", title: "Review the example", attributes: { status: "todo" } },
        { id: "three", title: "Publish the docs", attributes: { status: "done" } },
      ],
    }),
  },
});
export const ticketsPage = definePage({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  mode: workbenchModes.project,
  main: {
    kind: "view",
    view: tickets.ref,
    cardinality: "one",
  },
  slots: [],
});
export default defineExtension({
  statuses: [workflow],
  views: [tickets],
  pages: [ticketsPage],
});
