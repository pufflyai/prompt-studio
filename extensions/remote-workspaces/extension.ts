import {
  type CommandContext,
  defineCommand,
  defineExtension,
  defineKeybinding,
  type ExtensionWorkspace,
  l10n,
  packageAsset,
  params,
} from "@pstdio/sdk/extensions";
import { remoteHarness } from "./harness";
import { pocketCoder } from "./pocketcoder";
import { remoteWorkspace, workspaceParams } from "./workspace";

const providerId = (ctx: CommandContext) => `${ctx.extensionId}.workspace-type.${remoteWorkspace.id}`;
const workspaceShorthand = (workspace: ExtensionWorkspace) => workspace.shorthand ?? workspace.workspace_shorthand;
const isReady = (workspace: ExtensionWorkspace) => (workspace.providerState ?? workspace.provider_state) === "ready";

const prepareWorkspace = (ctx: CommandContext, workspaceInput: Record<string, string | undefined>) =>
  ctx.workspaces.create({
    project_id: ctx.projectId,
    shorthand_base: "remote",
    provider_id: providerId(ctx),
    params: Object.fromEntries(
      Object.entries(workspaceInput).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  });

const startSession = (ctx: CommandContext, workspace: ExtensionWorkspace, prompt: string) =>
  ctx.sessions.create({
    title: `PocketCoder: ${workspaceShorthand(workspace) ?? workspace.id}`,
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
    return { workspaceId: workspace.id, shorthand: workspaceShorthand(workspace), ready: isReady(workspace) };
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
    const owner = workspace?.providerId ?? workspace?.provider_id;
    if (!workspace || owner !== providerId(ctx) || !isReady(workspace))
      throw new Error("This PocketCoder workspace is not ready.");
    ctx.signal.throwIfAborted();
    return { sessionId: (await startSession(ctx, workspace, input.prompt)).id };
  },
});

const launch = defineCommand({
  id: "launch",
  title: l10n("commands.launch", "Launch PocketCoder session"),
  automation: true,
  cli: true,
  mutating: true,
  palette: [{ group: "PocketCoder", icon: "cloud", label: l10n("commands.launch", "Launch PocketCoder session") }],
  params: {
    ...workspaceParams,
    prompt: promptParam,
  },
  async run(ctx, input) {
    const { prompt, ...workspaceInput } = input;
    const workspace = await prepareWorkspace(ctx, workspaceInput);
    if (!isReady(workspace))
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
