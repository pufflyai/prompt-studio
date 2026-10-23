import { defineKeybinding } from "@pstdio/sdk/extensions";
import { createNoteCommand, renameNoteCommand } from "./commands";
import { createFolderCommand, moveNoteCommand } from "./folder-commands";
import { note, notesPage } from "./pages";

export const noteShortcuts = [
  defineKeybinding({
    id: "go-notes",
    layer: "go",
    key: "N",
    sticky: true,
    action: { kind: "page", page: notesPage.ref },
  }),
  defineKeybinding({
    id: "create-note",
    layer: "create",
    key: "N",
    action: { kind: "command", target: { command: createNoteCommand.ref } },
  }),
  defineKeybinding({
    id: "extension-open",
    layer: "extensions",
    key: "O",
    sticky: true,
    action: { kind: "page", page: notesPage.ref },
  }),
  ...(
    [
      ["new", "N", createNoteCommand],
      ["folder", "F", createFolderCommand],
      ["rename", "R", renameNoteCommand],
      ["move", "M", moveNoteCommand],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `extension-${id}`,
      layer: "extensions",
      key,
      action: { kind: "command", target: { command: command.ref } },
    }),
  ),
  ...(
    [
      ["new", "N", createNoteCommand],
      ["rename", "R", renameNoteCommand],
      ["move", "M", moveNoteCommand],
    ] as const
  ).map(([id, key, command]) =>
    defineKeybinding({
      id: `current-${id}`,
      layer: "current",
      key,
      targetScope: "resource",
      when: { resourceType: [note.ref] },
      action: { kind: "command", target: { command: command.ref } },
    }),
  ),
];
