import { defineNavigationTree, defineView, l10n, viewDataEvents, workbenchModes } from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { listFolders } from "./folders";
import { listNotes } from "./notes";
import { notesChanged, notesMount, noteTarget } from "./pages";
import { folderActions, newFolderAction, newNoteAction, noteActions } from "./tree-actions";

export const notesTree = defineView({
  id: "note-list",
  title: l10n("views.noteList", "Notes"),
  body: {
    kind: "tree",
    refreshEvents: [notesChanged, viewDataEvents.workspacesChanged],
    body: async (ctx) => {
      const { readable, writable } = await notesFileAccess(ctx);
      const [notes, folders] = readable
        ? await Promise.all([listNotes(notesMount(ctx)), listFolders(notesMount(ctx))])
        : [[], []];
      const noteNode = (note: (typeof notes)[number]) => ({
        id: note.id,
        label: note.title,
        icon: "file-text",
        target: noteTarget(note.id, note.title),
        contextMenuActions: noteActions(note, writable, folders),
      });
      const folderIds = new Set(folders.map((folder) => folder.id));
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
              canHide: true,
              actions: [newNoteAction(writable), newFolderAction(writable)],
              children: [
                ...folders.map((folder) => ({
                  id: `folder:${folder.id}`,
                  label: folder.title,
                  icon: "folder",
                  collapsible: true,
                  actions: [newNoteAction(writable, folder.id)],
                  contextMenuActions: folderActions(folder, writable),
                  children: notes.filter((note) => note.folderId === folder.id).map(noteNode),
                })),
                ...notes.filter((note) => !note.folderId || !folderIds.has(note.folderId)).map(noteNode),
              ],
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
