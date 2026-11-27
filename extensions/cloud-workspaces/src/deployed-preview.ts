import { type CommandRef, defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { getDeployed } from "./deployed-controller";
import { canOpenDeployedPreview } from "./deployed-machine-resource";
import { type ControllerMachine, machinePath } from "./machines";
import { deployedMachineActionsSlot } from "./resources";

export { canOpenDeployedPreview } from "./deployed-machine-resource";

const openRemotePreview: CommandRef<{ workspaceId: string }, { workspaceId: string; url: string; expiresAt: string }> =
  {
    kind: "command",
    extensionId: "pocketcoder.remote-testing",
    id: "preview.open",
  };

export const openDeployedPreview = defineCommand({
  id: "deployed.preview-open",
  title: l10n("cloud-workspaces.open-app-preview", "Open app preview"),
  cli: true,
  menus: [{ slot: deployedMachineActionsSlot, icon: "external-link", when: { metadata: { canOpenPreview: true } } }],
  params: {
    machineId: params.text({ label: l10n("cloud-workspaces.machine-id", "Machine ID"), resolvedFrom: "resource" }),
  },
  async run(ctx, input) {
    const id = input.machineId ?? ctx.resource?.id;
    if (!id) throw new Error("Choose a deployed preview workspace.");
    const machine = await getDeployed<ControllerMachine>(ctx.connections, machinePath(id), ctx.signal);
    if (!canOpenDeployedPreview(machine)) throw new Error("Choose a ready workspace started with Run Prompt Studio.");

    if (machine.metadata?.kito_workflow === "true") {
      const result = await ctx.commands.execute(openRemotePreview, { params: { workspaceId: machine.id } });
      if (!result.ok) throw new Error(result.reason ?? "Could not open the Kito preview.");
      const link = new URL(result.value.url);
      if (link.protocol !== "https:") throw new Error("The app preview link must use HTTPS.");
      ctx.navigation.open({ kind: "href", href: link.href });
      return { workspaceId: machine.id, url: link.href, expiresAt: result.value.expiresAt };
    }

    const bridge = (await ctx.settings.all()).previewBridgePath;
    if (typeof bridge !== "string" || !bridge.trim())
      throw new Error("Set the Preview URL helper in Cloud Workspaces settings.");
    if (!(await Bun.file(bridge).exists()))
      throw new Error("The configured Preview URL helper was not found on this device.");
    const result = await ctx.process.run({ command: ["bun", bridge, machine.id], timeoutMs: 10 * 60_000 });
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Could not open the app preview.");
    const { url, expiresAt } = JSON.parse(result.stdout) as { url: string; expiresAt: string };
    const link = new URL(url);
    if (link.protocol !== "https:") throw new Error("The app preview link must use HTTPS.");
    ctx.navigation.open({ kind: "href", href: link.href });
    return { workspaceId: machine.id, url: link.href, expiresAt };
  },
});
