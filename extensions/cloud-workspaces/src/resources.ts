import { defineResourceKind, eventRef, l10n, resourceMenuSlotRef } from "@pstdio/sdk/extensions";

export const instanceKind = defineResourceKind({
  id: "instance",
  label: l10n("cloud-workspaces.pocketcoder-instance", "PocketCoder instance"),
  icon: "server",
});
export const deployedInstanceKind = defineResourceKind({
  id: "deployed-instance",
  label: l10n("cloud-workspaces.cloud-workspace", "Cloud workspace"),
  icon: "cloud",
});
export const machineKind = defineResourceKind({
  id: "machine",
  label: l10n("cloud-workspaces.pocketcoder-machine", "PocketCoder machine"),
  icon: "bot",
  menuSlots: [{ id: "actions", placement: "context-menu", access: "owner" }],
});
export const machineActionsSlot = resourceMenuSlotRef(machineKind.ref, "actions");
export const deployedMachineKind = defineResourceKind({
  id: "deployed-machine",
  label: l10n("cloud-workspaces.deployed-workspace", "Deployed workspace"),
  icon: "bot",
  menuSlots: [{ id: "actions", placement: "context-menu", access: "owner" }],
});
export const deployedMachineActionsSlot = resourceMenuSlotRef(deployedMachineKind.ref, "actions");
export const changed = eventRef({ extensionId: "pocketcoder.pocketcoder", id: "changed" });
export const templateKind = defineResourceKind({
  id: "template",
  label: l10n("cloud-workspaces.agent-template", "Agent template"),
  icon: "package",
});
