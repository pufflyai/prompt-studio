import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const task = defineResourceKind({ id: "zipline-task", label: "Task" });
const pageRef = { kind: "page" as const, id: "zipline-task" };
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
  id: "zipline",
  title: "Zipline",
  path: "zipline",
  mode: workbenchModes.project,
  main: { kind: "view", view: board.ref, cardinality: "one" },
  slots: [],
});
const ziplineDetailPage = definePage({
  id: pageRef.id,
  title: "Task",
  path: "zipline/task",
  mode: workbenchModes.project,
  parent: ziplinePage.ref,
  resource: { kinds: [task.ref] },
  main: { kind: "view", view: board.ref, cardinality: "one" },
  slots: [
    {
      id: "inspector",
      region: "side",
      openOn: "page-resource",
      item: { kind: "binding", binding: { kinds: [task.ref], view: inspector.ref, cardinality: "one" } },
    },
  ],
});
export default defineExtension({
  resourceKinds: [task],
  views: [board, inspector],
  pages: [ziplinePage, ziplineDetailPage],
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
