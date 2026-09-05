# Runnable extension examples

These complete modules live in `extensions/extension-lab/src/examples`. Each exports a public `defineExtension` value. Extension Lab installs their contributions together. The repository compiles them, normalizes them into host metadata, and exercises their UI with Playwright.

Copy one module to `extension.ts` in a package with the current `@pstdio/sdk` dependency and matching `engines.pstdio`. Use `pst extensions dev <path>` in a linked project.

## Commands and resource header actions

Contributions are arrays of definitions. Each definition has an id. A resource kind owns menus; its page chooses placement.

```ts
import {
  defineCommand,
  defineExtension,
  defineResourceKind,
  params,
  resourceMenuSlotRef,
} from "@pstdio/sdk/extensions";

const ticket = defineResourceKind({
  id: "example-ticket",
  menuSlots: [{ id: "header-actions", placement: "header-primary", access: "owner" }],
});
const createTicket = defineCommand({
  id: "example-create-ticket",
  title: "Create example ticket",
  cli: {
    path: ["example", "create-ticket"],
    examples: ['pst extension-lab example create-ticket --title "Review the API"'],
  },
  params: { title: params.text({ label: "Title", required: true }) },
  async run(_ctx, input) {
    return { title: input.title };
  },
});
const runAttempt = defineCommand({
  id: "example-run-attempt",
  title: "Run attempt",
  menus: [
    {
      slot: resourceMenuSlotRef(ticket.ref, "header-actions"),
      label: "Run attempt",
      icon: "play",
      presentation: "button",
    },
  ],
  async run(ctx) {
    return { ticket: ctx.resource?.id };
  },
});
export default defineExtension({ resourceKinds: [ticket], commands: [createTicket, runAttempt] });
```

## Editable documents with navigation

Scribble saves through ctx.storage and supplies a page-owned navigation tree. Each pinned document has its own primary instance.

```ts
import {
  defineExtension,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";

const note = defineResourceKind({ id: "scribble-note", label: "Note" });
const documents = [
  { id: "welcome", label: "Welcome note", content: "# Welcome\n\nWrite something here.\n" },
  { id: "ideas", label: "Ideas note", content: "# Ideas\n\nKeep your ideas here.\n" },
];
const editor = defineView({
  id: "scribble-editor",
  title: "Note",
  body: {
    kind: "file",
    load: async (ctx, { renderer }) => ({
      fileName: `${renderer.resource!.id}.md`,
      content:
        (await ctx.storage.get<string>(`scribble:${renderer.resource!.id}`)) ??
        documents.find((document) => document.id === renderer.resource!.id)?.content ??
        "",
    }),
    save: async (ctx, { renderer, content }) => {
      await ctx.storage.set(`scribble:${renderer.resource!.id}`, content);
    },
  },
});
export const scribblePage = definePage({
  id: "scribble",
  title: "Scribble",
  path: "scribble",
  mode: workbenchModes.project,
  parent: workbenchPages.start,
  slots: [
    {
      id: "document",
      role: "primary",
      region: "main",
      binding: { kind: note.ref, view: editor.ref, cardinality: "many" },
    },
  ],
});
const openNote = (document: (typeof documents)[number]) => ({
  kind: "page" as const,
  page: scribblePage.ref,
  resource: { type: note.id, id: document.id, label: document.label },
  open: "pin" as const,
});
const files = defineView({
  id: "scribble-files",
  title: "Notes",
  body: {
    kind: "tree",
    body: async () => [
      {
        id: "notes",
        label: "Notes",
        collapsible: false,
        nodes: documents.map((document) => ({
          id: document.id,
          label: document.label,
          icon: "FileText",
          target: openNote(document),
        })),
      },
    ],
  },
});
export default defineExtension({
  resourceKinds: [note],
  views: [editor, files],
  pages: [scribblePage],
  navigationItems: [
    defineNavigationItem({
      id: "scribble",
      label: "Scribble",
      icon: "Notebook",
      owner: workbenchModes.project,
      slot: "content",
      action: openNote(documents[0]),
    }),
  ],
  navigationTrees: [
    defineNavigationTree({ id: "scribble-files", owner: scribblePage.ref, slot: "content", view: files.ref }),
  ],
});
```

## A board with an inspector

Zipline keeps the board in main. Selecting a row opens a resource in the same page and opens its inspector in side.

```ts
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
```

## A list with a reader

Pigeon uses a native table and read-only file view. It uses the same page and auxiliary binding rules as Zipline.

```ts
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const message = defineResourceKind({ id: "pigeon-message", label: "Message" });
const pageRef = { kind: "page" as const, id: "pigeon" };
const messages = [
  { id: "hello", subject: "Hello from Pigeon", content: "Your first message." },
  { id: "meeting", subject: "Friday meeting", content: "Meet at ten on Friday." },
];
const inbox = defineView({
  id: "pigeon-inbox",
  title: "Inbox",
  body: {
    kind: "dataTable",
    columns: [{ id: "subject", label: "Subject" }],
    query: async () => ({
      rows: messages.map((item) => ({
        id: item.id,
        values: { subject: item.subject },
        resource: { type: message.id, id: item.id, label: item.subject },
      })),
    }),
    onRowActivate: async (_ctx, { row }) => ({ kind: "page", page: pageRef, resource: row.resource }),
  },
});
const reader = defineView({
  id: "pigeon-reader",
  title: "Message reader",
  body: {
    kind: "file",
    load: async (_ctx, { renderer }) => ({
      fileName: "message.md",
      content: `# ${renderer.resource!.label}\n\n${messages.find((item) => item.id === renderer.resource!.id)?.content ?? ""}`,
    }),
  },
});
export const pigeonPage = definePage({
  id: pageRef.id,
  title: "Pigeon",
  path: "pigeon",
  mode: workbenchModes.project,
  slots: [
    {
      id: "inbox",
      role: "primary",
      region: "main",
      view: inbox.ref,
      binding: { kind: message.ref, view: inbox.ref, cardinality: "one" },
    },
    {
      id: "reader",
      role: "auxiliary",
      region: "side",
      openOn: "page-resource",
      binding: { kind: message.ref, view: reader.ref, cardinality: "one" },
    },
  ],
});
export default defineExtension({
  resourceKinds: [message],
  views: [inbox, reader],
  pages: [pigeonPage],
  navigationItems: [
    defineNavigationItem({
      id: "pigeon",
      label: "Pigeon",
      icon: "Mail",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: pigeonPage.ref },
    }),
  ],
});
```

## Navigation and close behavior

Use `parent` on a page target for contextual breadcrumbs. Name each destination page explicitly; resource metadata does not choose pages. Without a target parent, the declared page hierarchy applies.

Closing the last primary instance of a bound-only page follows its declared `parent`, even when the current breadcrumb has a contextual parent. A hybrid primary returns to its static view.

`openOn: "page-resource"` opens the auxiliary binding when navigation supplies a matching page resource. Closing it keeps it closed until another navigation opens it. Navigating without a resource does not clear previously opened auxiliary instances. Leaving the page removes its panels from the active layout.

Use `navigationTrees` or `navigationItems` for the shared Sidenav. Page slots accept `main`, `side`, or `secondary`; the primary slot must use `main`.

See [the API reference](extension-api.md) for hooks, schedules, assets, connections, and other contribution types.
