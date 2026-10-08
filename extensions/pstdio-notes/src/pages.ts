import {
  defineArtifactMount,
  definePage,
  defineResourceKind,
  defineView,
  type ExtensionContextBase,
  eventRef,
  l10n,
  type ResourceRef,
  viewDataEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { noteExists, readNote, readNoteTitle, writeNote } from "./notes";

export const notesChanged = eventRef<{ noteId?: string }>({
  extensionId: "pstdio.pstdio-notes",
  id: "notes.changed",
});

export const documents = defineArtifactMount({
  id: "documents",
  path: "documents",
  label: l10n("mounts.documents", "Notes"),
});

export const note = defineResourceKind({
  id: "note",
  label: l10n("resources.note", "Note"),
  icon: "file-text",
});

/** Notes belong to the default project workspace through the host artifact mount. */
export const notesMount = (ctx: ExtensionContextBase) => ctx.artifacts.mount(documents.id);

export const editor = defineView({
  id: "note-editor",
  title: l10n("views.noteEditor", "Note"),
  body: {
    kind: "file",
    refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
    load: async (ctx, { renderer }) => {
      const id = renderer.resource?.id;
      const { readable, writable } = await notesFileAccess(ctx);
      if (!readable)
        return {
          emptyState: { title: "Notes unavailable", description: "Open a ready local project folder to read notes." },
        };
      const mount = notesMount(ctx);
      // Reloads still handle missed removal events, including offline clients.
      if (!id || !(await noteExists(mount, id))) {
        return {
          emptyState: {
            title: id ? "Note not found" : "No note open",
            description: id ? "This note was deleted." : "Pick a note in the sidebar or create a new one.",
          },
        };
      }

      return {
        fileName: `${id}.md`,
        mimeType: "text/markdown",
        content: await readNote(mount, id),
        editable: writable,
        placeholder: "Write your notes here...",
      };
    },
    save: async (ctx, { renderer, content }) => {
      const id = renderer.resource?.id;
      const mount = notesMount(ctx);
      if (!id) throw new Error("No note open");

      await writeNote(mount, id, content);
      await ctx.events.emit(notesChanged, { noteId: id });
      return { revision: new Date().toISOString() };
    },
  },
});

export const notesPage = definePage({
  id: "notes",
  title: l10n("pages.notes", "Notes"),
  path: "notes",
  icon: "notebook-pen",
  mode: workbenchModes.project,
  main: { kind: "panels", empty: editor.ref },
  slots: [
    {
      id: "note",
      region: "main",
      order: 0,
      mountStrategy: "keep-mounted",
      tab: {
        refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
        query: async (ctx, { renderer }) => {
          const id = renderer.resource?.id;
          if (!(await notesFileAccess(ctx)).readable) return {};
          const mount = notesMount(ctx);
          if (!id || !(await noteExists(mount, id))) return {};
          return { label: await readNoteTitle(mount, id) };
        },
      },
      item: {
        kind: "binding",
        binding: { kinds: [note.ref], view: editor.ref, cardinality: "many" },
      },
    },
  ],
});

export const noteResource = (
  id: string,
  label: string,
  context?: Pick<ExtensionContextBase, "extensionId" | "projectId">,
) =>
  ({
    type: note.id,
    id,
    label,
    extensionId: context?.extensionId,
    projectId: context?.projectId,
  }) satisfies ResourceRef;

export const noteTarget = (
  id: string,
  label: string,
  context?: Pick<ExtensionContextBase, "extensionId" | "projectId">,
) => ({
  kind: "compound" as const,
  targets: [
    { kind: "page" as const, page: notesPage.ref },
    {
      kind: "panel" as const,
      panel: notesPage.panels.note,
      resource: noteResource(id, label, context),
      open: "pin" as const,
    },
  ],
});
