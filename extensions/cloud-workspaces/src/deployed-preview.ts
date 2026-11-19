import { defineCommand, params } from "@pstdio/sdk/extensions";
import { getDeployed } from "./deployed-controller";
import { type ControllerMachine, machinePath } from "./machines";
import { deployedMachineActionsSlot } from "./resources";

export function canOpenDeployedPreview(machine: ControllerMachine) {
  return (
    machine.state === "ready" &&
    machine.metadata?.purpose === "pstdio-preview" &&
    ["prompt-studio-preview", "prompt-studio-preview-branch"].includes(machine.template.name)
  );
}

export const openDeployedPreview = defineCommand({
  id: "deployed.preview-open",
  title: "Open app preview",
  cli: true,
  menus: [{ slot: deployedMachineActionsSlot, icon: "external-link", when: { metadata: { canOpenPreview: true } } }],
  params: { machineId: params.text({ label: "Machine ID", resolvedFrom: "resource" }) },
  async run(ctx, input) {
    const id = input.machineId ?? ctx.resource?.id;
    if (!id) throw new Error("Choose a deployed preview workspace.");
    const machine = await getDeployed<ControllerMachine>(ctx.connections, machinePath(id), ctx.signal);
    if (!canOpenDeployedPreview(machine)) throw new Error("Choose a ready workspace started with Run Prompt Studio.");

    const bridge = (await ctx.settings.all()).previewBridgePath;
    if (typeof bridge !== "string" || !bridge.trim())
      throw new Error("Set the Preview URL helper in Cloud Workspaces settings.");
    if (!(await Bun.file(bridge).exists()))
      throw new Error("The configured Preview URL helper was not found on this device.");
    const result = await ctx.process.run({ command: ["bun", bridge, machine.id], timeoutMs: 10 * 60_000 });
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Could not open the app preview.");
    const { url } = JSON.parse(result.stdout) as { url: string };
    const link = new URL(url);
    if (link.protocol !== "https:") throw new Error("The app preview link must use HTTPS.");
    ctx.navigation.open({ kind: "href", href: link.href });
    return { url: link.href };
  },
});
