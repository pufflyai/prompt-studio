import { l10n, params, type TreeAction } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand } from "./commands";
import { createFolderCommand, deleteFolderCommand, renameFolderCommand } from "./folder-commands";
import type { listFolders } from "./folders";
import type { listNotes } from "./notes";

type Folder = Awaited<ReturnType<typeof listFolders>>[number];
type Note = Awaited<ReturnType<typeof listNotes>>[number];

export const newNoteAction = (writable: boolean, folderId?: string) => ({
  id: "create",
  label: l10n("tree.actions.createNote", "New note"),
  icon: "plus",
  command: createNoteCommand.ref,
  disabled: !writable,
  params: { folderId },
});

export const newFolderAction = (writable: boolean) => ({
  id: "create-folder",
  label: l10n("tree.actions.createFolder", "New folder"),
  icon: "folder-plus",
  command: createFolderCommand.ref,
  disabled: !writable,
  input: { title: params.text({ label: l10n("params.folderName", "Folder name"), required: true }) },
  submitLabel: "Create",
});

export const noteActions = (note: Note, writable: boolean) => {
  const actions: TreeAction[] = [
    {
      id: "rename",
      label: l10n("tree.actions.renameNote", "Rename note"),
      icon: "pencil",
      command: renameNoteCommand.ref,
      disabled: !writable,
      params: { noteId: note.id },
      input: { title: params.text({ label: l10n("params.title", "Title"), required: true, defaultValue: note.title }) },
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
  ];
  return actions;
};

export const folderActions = (folder: Folder, writable: boolean) => {
  const actions: TreeAction[] = [
    {
      id: "rename-folder",
      label: l10n("tree.actions.renameFolder", "Rename folder"),
      icon: "pencil",
      command: renameFolderCommand.ref,
      disabled: !writable,
      params: { folderId: folder.id },
      input: {
        title: params.text({
          label: l10n("params.folderName", "Folder name"),
          required: true,
          defaultValue: folder.title,
        }),
      },
      submitLabel: "Rename",
    },
    {
      id: "delete-folder",
      label: l10n("tree.actions.deleteFolder", "Remove folder (keep notes)"),
      icon: "trash",
      command: deleteFolderCommand.ref,
      disabled: !writable,
      params: { folderId: folder.id },
    },
  ];
  return actions;
};
