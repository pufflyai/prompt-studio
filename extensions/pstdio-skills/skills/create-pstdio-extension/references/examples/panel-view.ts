import {
  type CommandContext,
  defineCommand,
  defineExtension,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  type PlacementTabPresentation,
  packageAsset,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const note = defineResourceKind({ id: "note", label: "Note" });
const draft = defineResourceKind({ id: "note-draft", label: "Draft" });
export const notePage = { kind: "page", id: "note" } as const;
const save = (ctx: CommandContext, key: string, value: { id: string; title: string; type: string }) =>
  ctx.storage.records.commit({
    operationId: ctx.storage.ids.create(),
    edits: [{ recordId: ctx.storage.records.id(key), replace: value }],
  });

export const createNote = defineCommand({
  id: "create-note",
  title: "Save note",
  params: { title: params.text({ required: true }) },
  async run(ctx, input) {
    const id = ctx.storage.ids.create();
    await save(ctx, `note/${id}`, { id, title: input.title, type: note.id });
    const resource = { type: note.id, id, label: input.title };
    // A resource-free Main composer changes page. A draft viewer keeps its current owner.
    ctx.navigation.open({
      kind: "viewer",
      operation: "replace",
      from: ctx.resource,
      resource,
      ...(!ctx.resource ? { page: notePage } : {}),
    });
    return resource;
  },
});
const newViewer = defineCommand({
  id: "new-viewer",
  title: "New note viewer",
  async run(ctx) {
    const id = ctx.storage.ids.create();
    await save(ctx, `draft/${id}`, { id, title: "New note", type: draft.id });
    ctx.navigation.open({
      kind: "panel",
      panel: { kind: "placement", id: "notes" },
      resource: { type: draft.id, id, label: "New note" },
      open: "pin",
    });
  },
});
const tab: PlacementTabPresentation = {
  async query(ctx, input) {
    const from = input.renderer.resource;
    const notes = (await ctx.storage.records.list()).flatMap((record) => {
      const value = record.value;
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        value.type !== note.id ||
        typeof value.id !== "string" ||
        typeof value.title !== "string"
      )
        return [];
      return [
        {
          id: value.id,
          label: value.title,
          action: {
            kind: "viewer" as const,
            operation: "switch" as const,
            from,
            resource: { type: note.id, id: value.id, label: value.title },
            ...(!from ? { page: notePage } : {}),
          },
        },
      ];
    });
    return { label: from?.label ?? "New note", menu: [{ id: "notes", rows: notes }] };
  },
};
const editor = defineView({
  id: "editor",
  title: "Note",
  body: {
    kind: "webview",
    entry: packageAsset("./panel-view-entry.tsx", import.meta.url),
    capabilities: ["commands.execute", "navigation.open"],
  },
});
const viewer = definePlacement({
  id: "notes",
  mode: workbenchModes.project,
  region: "side",
  tab,
  item: {
    kind: "binding",
    binding: {
      kinds: [note.ref, draft.ref],
      view: editor.ref,
      cardinality: "many",
      add: { kind: "command", target: { command: newViewer.ref } },
    },
  },
});
const home = definePage({
  id: "notes",
  title: "Notes",
  path: "notes",
  mode: workbenchModes.project,
  main: { kind: "view", presentation: "page", view: editor.ref, cardinality: "one", tab },
  panelView: viewer.ref,
  slots: [],
});
const detail = definePage({
  id: notePage.id,
  title: "Note",
  path: "note",
  parent: home.ref,
  mode: workbenchModes.project,
  resource: { kinds: [note.ref, draft.ref] },
  main: { kind: "view", presentation: "page", view: editor.ref, cardinality: "many", tab },
  panelView: viewer.ref,
  slots: [],
});
export default defineExtension({
  resourceKinds: [note, draft],
  views: [editor],
  pages: [home, detail],
  placements: [viewer],
  commands: [newViewer, createNote],
  navigationItems: [
    defineNavigationItem({
      id: "notes",
      owner: workbenchModes.project,
      label: "Notes",
      action: { kind: "page", page: home.ref, intent: "restore" },
    }),
  ],
});
