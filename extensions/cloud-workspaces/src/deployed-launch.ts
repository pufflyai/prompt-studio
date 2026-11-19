import { defineCommand, params } from "@pstdio/sdk/extensions";
import { createDeployedWorkspace, listDeployed } from "./deployed-controller";
import type { LabTemplate } from "./lab-model";
import { changed } from "./resources";

export const deployedTemplateChoices = defineCommand({
  id: "deployed.template-choices",
  title: "List launchable templates on the deployed controller",
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
  title: "Launch workspace",
  mutating: true,
  params: {
    template: params.select({
      label: "Template",
      required: true,
      options: { command: deployedTemplateChoices.ref, valueField: "value", labelField: "label" },
    }),
    name: params.text({ label: "Workspace name" }),
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
