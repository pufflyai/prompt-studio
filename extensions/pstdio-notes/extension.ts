import { defineExtension } from "@pstdio/sdk/extensions";
import { createNoteCommand, deleteNoteCommand, renameNoteCommand } from "./src/commands";
import { documents, editor, note, notesPage } from "./src/pages";
import { notesTree, notesTreeNavigation } from "./src/tree";

export default defineExtension({
  artifactMounts: [documents],
  resourceKinds: [note],
  views: [editor, notesTree],
  pages: [notesPage],
  commands: [createNoteCommand, deleteNoteCommand, renameNoteCommand],
  navigationTrees: [notesTreeNavigation],
});
