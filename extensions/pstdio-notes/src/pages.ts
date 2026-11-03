import {
  definePage,
  defineView,
  type ExtensionContextBase,
  l10n,
  type ResourceRef,
  viewDataEvents,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { notesChanged } from "./events";
import { notesFileAccess } from "./file-access";
import { documents } from "./mounts";
import { note } from "./resource-kinds";
import { noteText } from "./text-source";

export { notesChanged } from "./events";
export { note } from "./resource-kinds";

import { noteExists, readNoteSource, readNoteTitle } from "./notes";

/** Notes belong to the default project workspace through the host artifact mount. */
export const notesMount = (ctx: ExtensionContextBase) => ctx.artifacts.mount(documents.id);

export const editor = defineView({
  id: "note-editor",
  title: l10n("views.noteEditor", "Note"),
  icon: "file-text",
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

      let content: string;
      try {
        content = await readNoteSource(mount, id);
      } catch (error) {
        if (await noteExists(mount, id)) throw error;
        return { emptyState: { title: "Note not found", description: "This note was deleted." } };
      }
      return {
        fileName: `${id}.md`,
        mimeType: "text/markdown",
        content,
        textDocument: { sourceId: noteText.id, params: { noteId: id } },
        editable: writable,
        placeholder: "Write your notes here...",
      };
    },
  },
});

export const notesPage = definePage({
  id: "notes",
  title: l10n("pages.notes", "Notes"),
  path: "notes",
  icon: "notebook-pen",
  mode: workbenchModes.project,
  main: { kind: "panels" },
  slots: [
    {
      id: "note",
      region: "main",
      addableIn: ["main"],
      order: 0,
      mountStrategy: "keep-mounted",
      tab: {
        refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
        query: async (ctx, { renderer }) => {
          const id = renderer.resource?.id;
          const { readable } = await notesFileAccess(ctx);
          if (!readable) return {};
          const mount = notesMount(ctx);
          if (!id || !(await noteExists(mount, id))) return {};
          try {
            const label = await readNoteTitle(mount, id);
            return { label };
          } catch (error) {
            if (await noteExists(mount, id)) throw error;
            return {};
          }
        },
      },
      item: {
        kind: "binding",
        binding: {
          kinds: [note.ref],
          view: editor.ref,
          cardinality: "many",
          add: { kind: "command", target: { command: { kind: "command", id: "notes.create" } } },
        },
      },
    },
  ],
});

export const noteResource = (
  id: string,
  label: string,
  context?: Pick<ExtensionContextBase, "extensionId" | "projectId">,
  writable?: boolean,
) =>
  ({
    type: note.id,
    id,
    label,
    extensionId: context?.extensionId,
    projectId: context?.projectId,
    ...(writable === undefined ? {} : { metadata: { writable } }),
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
