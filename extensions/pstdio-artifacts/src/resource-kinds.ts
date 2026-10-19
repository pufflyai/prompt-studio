import { defineResourceKind, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

export const artifact = defineResourceKind({
  id: "artifact",
  label: l10n("resources.artifact", "Artifact"),
  icon: "file-code",
  resolve: { kind: "command", id: "resolve-resource" },
  menuSlots: [{ id: "actions", placement: "context-menu", access: "owner" }],
});
export const artifactActionsSlot = resourceMenuSlotRef(artifact.ref, "actions");
