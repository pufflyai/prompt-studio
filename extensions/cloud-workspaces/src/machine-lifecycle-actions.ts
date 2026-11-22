import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { instancesFor } from "./instances";
import { createMachineLifecycle, lifecycleInputParams } from "./machine-lifecycle";
import { providerParams } from "./machines";
import { machineActionsSlot } from "./resources";
import { machineTarget } from "./table-commands";

const inputParams = {
  machineId: params.text({
    label: l10n("cloud-workspaces.source-machine", "Source machine"),
    required: true,
    resolvedFrom: "resource",
  }),
  ...lifecycleInputParams,
  launchInput: params.longText({
    label: l10n(
      "cloud-workspaces.fresh-one-time-launch-input-json-optional",
      "Fresh one-time launch input (JSON, optional)",
    ),
    description: l10n(
      "cloud-workspaces.supply-a-new-bootstrap-if-required-old-launch-input-is-not-copied",
      "Supply a new bootstrap if required. Old launch input is not copied.",
    ),
  }),
  metadata: params.longText({
    label: l10n("cloud-workspaces.new-application-metadata-json-optional", "New application metadata (JSON, optional)"),
    description: l10n(
      "cloud-workspaces.relay-templates-need-new-pstdio-device-id-and-pstdio-workspace-id-here-old-values-are-not-copied",
      "Relay templates need new pstdio.device_id and pstdio.workspace_id here. Old values are not copied.",
    ),
  }),
};
const sourceTarget = (id: string) => machineTarget({ resource: { type: "machine", id } });

export function createMachineLifecycleActions(getInstances = instancesFor) {
  const lifecycle = createMachineLifecycle(getInstances);
  const relaunch = defineCommand({
    id: "machines.relaunch-row",
    title: l10n("cloud-workspaces.relaunch-machine", "Relaunch machine"),
    description: l10n(
      "cloud-workspaces.launch-a-fresh-machine-its-files-and-conversation-start-empty",
      "Launch a fresh machine. Its files and conversation start empty.",
    ),
    mutating: true,
    menus: [{ slot: machineActionsSlot, icon: "rotate-cw" }],
    params: inputParams,
    async run(ctx, input) {
      const result = await lifecycle.relaunchMachine.run(ctx, { ...input, ...sourceTarget(input.machineId) });
      ctx.notify.toast({ type: "success", message: "New machine queued. Connect when it is ready." });
      return result;
    },
  });
  const resume = defineCommand({
    id: "machines.resume-row",
    title: l10n("cloud-workspaces.resume-machine", "Resume machine"),
    description: l10n(
      "cloud-workspaces.restore-the-latest-ready-checkpoint-into-a-new-machine-including-its-files-and-conversation",
      "Restore the latest ready checkpoint into a new machine, including its files and conversation.",
    ),
    mutating: true,
    menus: [{ slot: machineActionsSlot, icon: "play", when: { metadata: { canResume: true } } }],
    params: { ...inputParams, templateVersion: providerParams.templateVersion },
    async run(ctx, input) {
      const result = await lifecycle.resumeMachine.run(ctx, { ...input, ...sourceTarget(input.machineId) });
      ctx.notify.toast({ type: "success", message: "New machine queued. Connect when it is ready." });
      return result;
    },
  });
  return { relaunch, resume };
}

export const machineLifecycleActions = createMachineLifecycleActions();
