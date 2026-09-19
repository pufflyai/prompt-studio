import { defineNavigationTree, defineView, l10n, params } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand } from "./commands";
import { listNotes } from "./notes";
import { notesChanged, notesMount, notesPage, noteTarget } from "./pages";

const newNoteAction = {
  id: "create",
  label: l10n("tree.actions.createNote", "New note"),
  icon: "plus",
  command: createNoteCommand.ref,
  input: { title: params.text({ label: l10n("params.title", "Title"), required: true }) },
  submitLabel: "Create",
};

export const notesTree = defineView({
  id: "note-list",
  title: l10n("views.noteList", "Notes"),
  body: {
    kind: "tree",
    refreshEvents: [notesChanged],
    body: async (ctx, { renderer }) => {
      const openNoteId = renderer.resource?.id;
      const notes = await listNotes(notesMount(ctx));

      return [
        {
          id: "notes",
          label: l10n("tree.sections.notes", "Notes"),
          collapsible: false,
          actions: [newNoteAction],
          emptyState: {
            title: l10n("tree.empty.title", "No notes yet"),
            description: l10n("tree.empty.description", "Create a note to start writing."),
          },
          nodes: notes.map((note) => ({
            id: note.id,
            label: note.title,
            icon: "file-text",
            selected: note.id === openNoteId,
            target: noteTarget(note.id, note.title),
            contextMenuActions: [
              {
                id: "delete",
                label: l10n("tree.actions.deleteNote", "Delete"),
                icon: "trash",
                command: deleteNoteCommand.ref,
                params: { noteId: note.id },
              },
            ],
          })),
        },
      ];
    },
  },
});

export const notesTreeNavigation = defineNavigationTree({
  id: "note-list",
  owner: notesPage.ref,
  slot: "content",
  view: notesTree.ref,
});
