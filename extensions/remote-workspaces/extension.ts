import {
  type CommandContext,
  defineCommand,
  defineExtension,
  defineKeybinding,
  l10n,
  packageAsset,
  params,
  projectSlots,
} from "@pstdio/sdk/extensions";
import { remoteHarness } from "./harness";
import { pocketCoder } from "./pocketcoder";
import { remoteWorkspace, workspaceParams } from "./workspace";

const providerId = (ctx: CommandContext) => `${ctx.extensionId}.workspace-type.${remoteWorkspace.id}`;

const prepareWorkspace = (ctx: CommandContext, workspaceInput: Record<string, string | undefined>) =>
  ctx.workspaces.create({
    project_id: ctx.projectId,
    shorthand_base: "remote",
    provider_id: providerId(ctx),
    params: Object.fromEntries(
      Object.entries(workspaceInput).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  });

const startSession = (
  ctx: CommandContext,
  workspace: { id: string; workspace_shorthand?: string | null },
  prompt: string,
) =>
  ctx.sessions.create({
    title: `PocketCoder: ${workspace.workspace_shorthand ?? workspace.id}`,
    prompt,
    workspaceId: workspace.id,
    harness: { harnessId: `${ctx.extensionId}.harness.${remoteHarness.id}` },
  });

const promptParam = params.longText({ label: l10n("params.prompt", "Prompt"), required: true });

export const prepareLaunchWorkspace = defineCommand({
  id: "prepare-launch-workspace",
  title: l10n("commands.prepare-launch-workspace", "Prepare PocketCoder workspace"),
  mutating: true,
  params: workspaceParams,
  async run(ctx, input) {
    const workspace = await prepareWorkspace(ctx, input);
    return {
      workspaceId: workspace.id,
      shorthand: workspace.workspace_shorthand ?? undefined,
      ready: workspace.provider_state === "ready",
    };
  },
});

export const startLaunchSession = defineCommand({
  id: "start-launch-session",
  title: l10n("commands.start-launch-session", "Start session on PocketCoder workspace"),
  mutating: true,
  params: {
    workspaceId: params.text({ label: l10n("params.workspace", "PocketCoder workspace"), required: true }),
    prompt: promptParam,
  },
  async run(ctx, input) {
    const workspace = await ctx.workspaces.get(input.workspaceId);
    if (workspace?.provider_id !== providerId(ctx) || workspace.provider_state !== "ready")
      throw new Error("This PocketCoder workspace is not ready.");
    ctx.signal.throwIfAborted();
    const session = await startSession(ctx, workspace, input.prompt);
    return { sessionId: session.id };
  },
});

const launch = defineCommand({
  id: "launch",
  title: l10n("commands.launch", "Launch PocketCoder session"),
  automation: true,
  cli: true,
  mutating: true,
  palette: [{ group: "PocketCoder", icon: "cloud", label: l10n("commands.launch", "Launch PocketCoder session") }],
  menus: [
    { slot: projectSlots.headerOverflow, label: l10n("commands.launch", "Launch PocketCoder session"), icon: "cloud" },
  ],
  params: {
    ...workspaceParams,
    prompt: promptParam,
  },
  async run(ctx, input) {
    const { prompt, ...workspaceInput } = input;
    const workspace = await prepareWorkspace(ctx, workspaceInput);
    if (workspace.provider_state !== "ready")
      throw new Error("The PocketCoder workspace did not become ready. Check its workspace status.");
    const session = await startSession(ctx, workspace, prompt);
    return { workspaceId: workspace.id, sessionId: session.id };
  },
});

export default defineExtension({
  defaultLocale: "en",
  translations: { fr: packageAsset("./l10n/fr.json", import.meta.url) },
  connections: [pocketCoder],
  workspaceTypes: [remoteWorkspace],
  harnesses: [remoteHarness],
  commands: [launch, prepareLaunchWorkspace, startLaunchSession],
  keybindings: [
    defineKeybinding({
      id: "keyboard-launch",
      layer: "create",
      key: "S",
      action: { kind: "command", target: { command: launch.ref } },
    }),
  ],
});
