import { defineResourceKind, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";
import { documentPaths } from "./mounts";

export const note = defineResourceKind({
  id: "note",
  activity: { comments: true },
  resolveMany: { kind: "command", id: "notes.resolve-many" },
  authorizeActivity: { kind: "command", id: "notes.authorize-activity" },
  label: l10n("resources.note", "Note"),
  icon: "file-text",
  resolve: { kind: "command", id: "notes.resolve" },
  paths: documentPaths.map((prefix) => ({ prefix, resolve: { kind: "command", id: "notes.resolve-path" } })),
  menuSlots: [{ id: "actions", placement: "context-menu", access: "owner" }],
});
export const noteActionsSlot = resourceMenuSlotRef(note.ref, "actions");
