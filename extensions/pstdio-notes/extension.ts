import { defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand } from "./src/commands";
import { documents, editor, note, notesPage } from "./src/pages";
import { notesNavigationItem, notesTree, notesTreeNavigation } from "./src/tree";

export default defineExtension({
  artifactMounts: [documents],
  resourceKinds: [note],
  views: [editor, notesTree],
  pages: [notesPage],
  commands: [createNoteCommand, deleteNoteCommand, renameNoteCommand],
  keybindings: [
    defineKeybinding({ id: "open-notes", key: "Alt+Shift+O", action: { kind: "page", page: notesPage.ref } }),
    defineKeybinding({
      id: "new-note",
      key: "Mod+Alt+N",
      action: { kind: "command", target: { command: createNoteCommand.ref } },
    }),
  ],
  navigationItems: [notesNavigationItem],
  navigationTrees: [notesTreeNavigation],
});
