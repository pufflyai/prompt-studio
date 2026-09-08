import { defineCommand, defineExtension, l10n, packageAsset, params, projectSlots } from "@pstdio/sdk/extensions";
import { remoteHarness } from "./harness";
import { pocketCoder } from "./pocketcoder";
import { remoteWorkspace, workspaceParams } from "./workspace";

const launch = defineCommand({
  id: "launch",
  title: l10n("commands.launch", "Launch PocketCoder session"),
  automation: true,
  cli: true,
  mutating: true,
  palette: [{ group: "PocketCoder", label: l10n("commands.launch", "Launch PocketCoder session") }],
  menus: [
    { slot: projectSlots.headerOverflow, label: l10n("commands.launch", "Launch PocketCoder session"), icon: "cloud" },
  ],
  params: {
    ...workspaceParams,
    prompt: params.longText({ label: l10n("params.prompt", "Prompt"), required: true }),
  },
  async run(ctx, input) {
    const { prompt, ...workspaceInput } = input;
    const workspace = await ctx.workspaces.create({
      project_id: ctx.projectId,
      shorthand_base: "remote",
      provider_id: `${ctx.extensionId}.workspace-type.${remoteWorkspace.id}`,
      params: Object.fromEntries(Object.entries(workspaceInput).filter(([, value]) => value !== undefined)),
    });
    if (workspace.provider_state !== "ready")
      throw new Error("The PocketCoder workspace did not become ready. Check its workspace status.");
    const session = await ctx.sessions.create({
      title: `PocketCoder: ${workspace.workspace_shorthand ?? workspace.id}`,
      prompt,
      workspaceId: workspace.id,
      harness: { harnessId: `${ctx.extensionId}.harness.${remoteHarness.id}` },
    });
    return { workspaceId: workspace.id, sessionId: session.id };
  },
});

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  connections: [pocketCoder],
  workspaceTypes: [remoteWorkspace],
  harnesses: [remoteHarness],
  commands: [launch],
});
