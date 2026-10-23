import { defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand, resolveNoteCommand } from "./src/commands";
import { createFolderCommand, deleteFolderCommand, moveNoteCommand, renameFolderCommand } from "./src/folder-commands";
import { noteShortcuts } from "./src/keyboard";
import { documents } from "./src/mounts";
import { editor, note, notesPage } from "./src/pages";
import { resolveNotePathCommand } from "./src/resolve-note-path";
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
    resolveNoteCommand,
    resolveNotePathCommand,
    createFolderCommand,
    renameFolderCommand,
    deleteFolderCommand,
    moveNoteCommand,
  ],
  keybindings: [
    ...noteShortcuts,
    defineKeybinding({ id: "open-notes", key: "Alt+Shift+O", action: { kind: "page", page: notesPage.ref } }),
    defineKeybinding({
      id: "new-note",
      key: "Mod+Alt+N",
      action: { kind: "command", target: { command: createNoteCommand.ref } },
    }),
  ],
  navigationTrees: [notesTreeNavigation],
});
