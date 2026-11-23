import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { createDeployedWorkspace, listDeployed } from "./deployed-controller";
import type { LabTemplate } from "./lab-model";
import { changed } from "./resources";

export const deployedTemplateChoices = defineCommand({
  id: "deployed.template-choices",
  title: l10n(
    "cloud-workspaces.list-launchable-templates-on-the-deployed-controller",
    "List launchable templates on the deployed controller",
  ),
  async run(ctx) {
    const templates = await listDeployed<LabTemplate>(ctx.connections, "/v1/templates");
    return templates
      .filter((template) => template.status !== "retired")
      .sort((a, b) => Number(b.status === "active") - Number(a.status === "active"))
      .map(({ name, version, status }) => ({
        value: `${name}@${version}`,
        label: `${name} ${version}${status === "active" ? " (active)" : ""}`,
      }));
  },
});

export const launchDeployedWorkspace = defineCommand({
  id: "deployed.machine-launch",
  title: l10n("cloud-workspaces.launch-workspace", "Launch workspace"),
  mutating: true,
  params: {
    template: params.select({
      label: l10n("cloud-workspaces.template", "Template"),
      required: true,
      options: { command: deployedTemplateChoices.ref, valueField: "value", labelField: "label" },
    }),
    name: params.text({ label: l10n("cloud-workspaces.workspace-name", "Workspace name") }),
  },
  async run(ctx, input) {
    const [name, version] = input.template.split("@");
    if (!name || !version) throw new Error("Choose a published template version.");
    const externalId = input.name?.trim() || `lab-${crypto.randomUUID()}`;
    const machine = await createDeployedWorkspace(ctx.connections, { name, version, externalId }, ctx.signal);
    await ctx.events.emit(changed, {});
    return { machineId: machine.id, state: machine.state };
  },
});
