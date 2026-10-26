import {
  defineArtifactMount,
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
// Note bodies are files. Records are for small structured data, and the host refuses records over 256 KiB.
const noteFiles = defineArtifactMount({ id: "notes", path: "notes", label: "Notes" });
const documents = [
  { id: "welcome", label: "Welcome note", content: "# Welcome\n\nWrite something here.\n" },
  { id: "ideas", label: "Ideas note", content: "# Ideas\n\nKeep your ideas here.\n" },
];
const editor = defineView({
  id: "scribble-editor",
  title: "Note",
  body: {
    kind: "file",
    load: async (ctx, { renderer }) => {
      const fileName = `${renderer.resource!.id}.md`;
      const files = ctx.artifacts.mount(noteFiles.id);
      const initial = documents.find((document) => document.id === renderer.resource!.id)?.content ?? "";
      return { fileName, content: (await files.exists(fileName)) ? await files.readText(fileName) : initial };
    },
    save: async (ctx, { renderer, content }) => {
      await ctx.artifacts.mount(noteFiles.id).writeText(`${renderer.resource!.id}.md`, content);
    },
  },
});
export const scribblePage = definePage({
  id: "scribble",
  title: "Scribble",
  path: "scribble",
  mode: workbenchModes.project,
  parent: workbenchPages.start,
  resource: { kinds: [note.ref] },
  main: { kind: "view", view: editor.ref, cardinality: "many" },
  slots: [],
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
  artifactMounts: [noteFiles],
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
