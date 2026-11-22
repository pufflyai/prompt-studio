import type { ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { type ControllerMachine, isTerminal } from "./machines";
import { deployedMachineKind } from "./resources";

export function canOpenDeployedPreview(machine: ControllerMachine) {
  return (
    machine.state === "ready" &&
    machine.metadata?.purpose === "pstdio-preview" &&
    ["prompt-studio-preview", "prompt-studio-preview-branch"].includes(machine.template.name)
  );
}

export function projectDeployedMachineResource(
  ctx: Pick<ExtensionContextBase, "extensionId" | "projectId">,
  machine: ControllerMachine,
) {
  return {
    type: deployedMachineKind.id,
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    id: machine.id,
    label: machine.external_id,
    icon: "bot",
    metadata: {
      canStop: !isTerminal(machine) && machine.state !== "terminating",
      canOpenPreview: canOpenDeployedPreview(machine),
    },
  } satisfies ResourceRef;
}
