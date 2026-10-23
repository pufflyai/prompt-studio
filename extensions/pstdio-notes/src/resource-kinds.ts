import { defineResourceKind, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { documentsPath } from "./mounts";

export const note = defineResourceKind({
  id: "note",
  label: l10n("resources.note", "Note"),
  icon: "file-text",
  resolve: { kind: "command", id: "notes.resolve" },
  paths: [{ prefix: documentsPath, resolve: { kind: "command", id: "notes.resolve-path" } }],
  menuSlots: [{ id: "actions", placement: "context-menu", access: "owner" }],
});
export const noteActionsSlot = resourceMenuSlotRef(note.ref, "actions");
