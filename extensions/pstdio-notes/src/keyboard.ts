import { defineKeybinding } from "@pstdio/sdk/extensions";
import { createNoteCommand, renameNoteCommand } from "./commands";
import { createFolderCommand, moveNoteCommand } from "./folder-commands";
import { note } from "./pages";
export const noteShortcuts = [
  defineKeybinding({
    id: "create-note",
    layer: "create",
    key: note.ref.id[0]!.toUpperCase(),
    action: { kind: "command", target: { command: createNoteCommand.ref, params: {} } },
  }),
  defineKeybinding({
    id: "create-folder",
    layer: "create",
    key: "F",
    action: { kind: "command", target: { command: createFolderCommand.ref } },
  }),
  ...(
    [
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
