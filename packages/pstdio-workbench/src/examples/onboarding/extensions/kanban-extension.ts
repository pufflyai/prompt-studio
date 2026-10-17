import { defineExtension, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const tickets = defineView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "kanban",
    attributes: [
      {
        id: "status",
        label: "Status",
        type: {
          kind: "enum",
          options: [
            { value: "todo", label: "To do", color: "gray" },
            { value: "doing", label: "Doing", color: "blue" },
            { value: "done", label: "Done", color: "green" },
          ],
        },
        groupable: true,
        displayable: true,
      },
    ],
    defaultSettings: {
      viewMode: "board",
      columnGrouping: "status",
      rowGrouping: "none",
      displayProperties: [],
    },
    defaultSorts: [{ attributeId: "status", direction: "asc" }],
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
  views: [tickets],
  pages: [ticketsPage],
});
