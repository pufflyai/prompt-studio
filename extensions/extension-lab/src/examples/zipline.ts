import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const task = defineResourceKind({ id: "zipline-task", label: "Task" });
const pageRef = { kind: "page" as const, id: "zipline" };
const tasks = [
  { id: "design", title: "Design the board", status: "todo" },
  { id: "ship", title: "Ship the board", status: "done" },
];
const board = defineView({
  id: "zipline-board",
  title: "Zipline board",
  body: {
    kind: "kanban",
    attributes: [
      {
        id: "status",
        label: "Status",
        type: {
          kind: "enum",
          options: [
            { value: "todo", label: "To do" },
            { value: "done", label: "Done" },
          ],
        },
      },
    ],
    defaultSettings: { viewMode: "board", columnGrouping: "status", rowGrouping: "none", displayProperties: [] },
    query: async () => ({
      rows: tasks.map((item) => ({
        id: item.id,
        title: item.title,
        attributes: { status: item.status },
        resource: { type: task.id, id: item.id, label: item.title },
      })),
    }),
    onRowActivate: async (_ctx, { row }) => ({ kind: "page", page: pageRef, resource: row.resource }),
  },
});
const inspector = defineView({
  id: "zipline-inspector",
  title: "Task inspector",
  body: {
    kind: "file",
    load: async (_ctx, { renderer }) => ({
      fileName: "task.md",
      content: `# ${renderer.resource!.label}\n\nInspect ${renderer.resource!.id}.`,
    }),
  },
});
export const ziplinePage = definePage({
  id: pageRef.id,
  title: "Zipline",
  path: "zipline",
  mode: workbenchModes.project,
  slots: [
    {
      id: "board",
      role: "primary",
      region: "main",
      view: board.ref,
      binding: { kind: task.ref, view: board.ref, cardinality: "one" },
    },
    {
      id: "inspector",
      role: "auxiliary",
      region: "side",
      openOn: "page-resource",
      binding: { kind: task.ref, view: inspector.ref, cardinality: "one" },
    },
  ],
});
export default defineExtension({
  resourceKinds: [task],
  views: [board, inspector],
  pages: [ziplinePage],
  navigationItems: [
    defineNavigationItem({
      id: "zipline",
      label: "Zipline",
      icon: "Columns3",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: ziplinePage.ref },
    }),
  ],
});
