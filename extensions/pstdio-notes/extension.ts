import { defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand } from "./src/commands";
import { createFolderCommand, deleteFolderCommand, moveNoteCommand, renameFolderCommand } from "./src/folder-commands";
import { documents, editor, note, notesPage } from "./src/pages";
import { noteResources } from "./src/resources";
import { notesTree, notesTreeNavigation } from "./src/tree";

export default defineExtension({
  artifactMounts: [documents],
  resourceKinds: [note],
  commandPaletteResources: [noteResources],
  views: [editor, notesTree],
  pages: [notesPage],
  commands: [
    createNoteCommand,
    deleteNoteCommand,
    renameNoteCommand,
    createFolderCommand,
    renameFolderCommand,
    deleteFolderCommand,
    moveNoteCommand,
  ],
  keybindings: [
    defineKeybinding({ id: "open-notes", key: "Alt+Shift+O", action: { kind: "page", page: notesPage.ref } }),
    defineKeybinding({
      id: "new-note",
      key: "Mod+Alt+N",
      action: { kind: "command", target: { command: createNoteCommand.ref } },
    }),
  ],
  navigationTrees: [notesTreeNavigation],
});
