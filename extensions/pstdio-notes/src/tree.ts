import { defineNavigationTree, defineView, l10n, params, viewDataEvents, workbenchModes } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand } from "./commands";
import { notesFileAccess } from "./file-access";
import { listNotes } from "./notes";
import { notesChanged, notesMount, noteTarget } from "./pages";

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
    refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
    body: async (ctx) => {
      const { readable, writable } = await notesFileAccess(ctx);
      const notes = readable ? await listNotes(notesMount(ctx)) : [];

      return [
        {
          id: "notes",
          collapsible: false,
          nodes: [
            {
              id: "notes",
              label: l10n("navigation.notes", "Notes"),
              icon: "notebook-pen",
              collapsible: true,
              actions: [{ ...newNoteAction, disabled: !writable }],
              children: notes.map((note) => ({
                id: note.id,
                label: note.title,
                icon: "file-text",
                target: noteTarget(note.id, note.title),
                contextMenuActions: [
                  {
                    id: "rename",
                    label: l10n("tree.actions.renameNote", "Rename note"),
                    icon: "pencil",
                    command: renameNoteCommand.ref,
                    disabled: !writable,
                    params: { noteId: note.id },
                    input: {
                      title: params.text({
                        label: l10n("params.title", "Title"),
                        required: true,
                        defaultValue: note.title,
                      }),
                    },
                    submitLabel: "Rename",
                  },
                  {
                    id: "delete",
                    label: l10n("tree.actions.deleteNote", "Delete"),
                    icon: "trash",
                    command: deleteNoteCommand.ref,
                    disabled: !writable,
                    params: { noteId: note.id },
                  },
                ],
              })),
            },
          ],
        },
      ];
    },
  },
});

export const notesTreeNavigation = defineNavigationTree({
  id: "note-list",
  owner: workbenchModes.project,
  slot: "content",
  view: notesTree.ref,
});
