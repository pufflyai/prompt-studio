import { defineExtension } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand } from "./src/commands";
import { documents, editor, note, notesNavigation, notesPage } from "./src/pages";
import { notesTree, notesTreeNavigation } from "./src/tree";

export default defineExtension({
  artifactMounts: [documents],
  resourceKinds: [note],
  views: [editor, notesTree],
  pages: [notesPage],
  commands: [createNoteCommand, deleteNoteCommand],
  navigationItems: [notesNavigation],
  navigationTrees: [notesTreeNavigation],
});
