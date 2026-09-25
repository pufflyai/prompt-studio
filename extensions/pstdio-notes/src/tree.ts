import { defineNavigationTree, defineView, l10n, params, workbenchModes } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand } from "./commands";
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
    refreshEvents: [notesChanged],
    body: async (ctx) => {
      const repo = await ctx.repos.getDefault();
      const notes = repo ? await listNotes(notesMount(ctx)) : [];

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
              description: repo ? undefined : "Add a repository to create notes.",
              actions: [{ ...newNoteAction, disabled: !repo }],
              children: notes.map((note) => ({
                id: note.id,
                label: note.title,
                icon: "file-text",
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
