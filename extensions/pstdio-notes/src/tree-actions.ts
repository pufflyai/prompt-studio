import { l10n, params, type TreeAction } from "@pstdio/sdk/extensions";
import { createNoteCommand } from "./commands";
import { createFolderCommand, deleteFolderCommand, renameFolderCommand } from "./folder-commands";
import type { listFolders } from "./folders";

type Folder = Awaited<ReturnType<typeof listFolders>>[number];

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
