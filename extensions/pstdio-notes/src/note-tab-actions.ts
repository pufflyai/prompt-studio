import { commandRef, l10n, type PlacementTabMenuGroup } from "@pstdio/sdk/extensions";

export const noteTabActions = (noteId: string, writable: boolean, title: string): PlacementTabMenuGroup[] => [
  {
    id: "note-actions",
    rows: [
      {
        id: "rename",
        label: l10n("tree.actions.renameNote", "Rename note"),
        icon: "pencil",
        disabled: !writable,
        action: {
          kind: "command",
          target: {
            command: commandRef({ extensionId: "pstdio.pstdio-notes", id: "notes.rename" }),
            params: { noteId, title },
          },
        },
      },
      {
        id: "delete",
        label: l10n("tree.actions.deleteNote", "Delete"),
        icon: "trash",
        disabled: !writable,
        action: {
          kind: "command",
          target: {
            command: commandRef({ extensionId: "pstdio.pstdio-notes", id: "notes.delete" }),
            params: { noteId },
          },
        },
      },
    ],
  },
];
