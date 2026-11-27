import { defineExtension, defineKeybinding, packageAsset } from "@pstdio/sdk/extensions";
import {
  checkNoteTitleCommand,
  createNoteCommand,
  deleteNoteCommand,
  renameNoteCommand,
  resolveNoteCommand,
  resolveNoteOpeningCommand,
  resolveNotesCommand,
} from "./src/commands";
import { createFolderCommand, deleteFolderCommand, moveNoteCommand, renameFolderCommand } from "./src/folder-commands";
import { noteShortcuts } from "./src/keyboard";
import { documents } from "./src/mounts";
import { editor, note, notePage, notesPage, notesViewer } from "./src/pages";
import { resolveNotePathCommand } from "./src/resolve-note-path";
import { noteResources } from "./src/resources";
import { noteText } from "./src/text-source";
import { notesTree, notesTreeNavigation } from "./src/tree";

export default defineExtension({
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  artifactMounts: [documents],
  textSources: [noteText],
  resourceKinds: [note],
  commandPaletteResources: [noteResources],
  views: [editor, notesTree],
  pages: [notesPage, notePage],
  placements: [notesViewer],
  commands: [
    resolveNotesCommand,
    createNoteCommand,
    deleteNoteCommand,
    checkNoteTitleCommand,
    renameNoteCommand,
    resolveNoteCommand,
    resolveNoteOpeningCommand,
    resolveNotePathCommand,
    createFolderCommand,
    renameFolderCommand,
    deleteFolderCommand,
    moveNoteCommand,
  ],
  keybindings: [
    ...noteShortcuts,
    defineKeybinding({
      id: "go-notes",
      layer: "go",
      key: "N",
      sticky: true,
      action: { kind: "page", page: notesPage.ref },
    }),
  ],
  navigationTrees: [notesTreeNavigation],
});
