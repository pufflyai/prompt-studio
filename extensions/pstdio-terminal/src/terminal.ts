import {
  defineCommand,
  definePlacement,
  defineResourceKind,
  defineView,
  type ExtensionContextBase,
  l10n,
  params,
  type ResourceRef,
  workbenchModes,
  workbenchResourceKinds,
  workspaceSlots,
} from "@pstdio/sdk/extensions";

export const terminalResource = defineResourceKind({
  id: "terminal",
  prefix: "TE",
  label: l10n("terminal.title", "Terminal"),
  icon: "square-terminal",
});

export const selectTerminalWorkspace = async (
  ctx: ExtensionContextBase,
  input: { workspaceId?: string; resource?: ResourceRef } = {},
) => {
  const resource = input.resource;
  if (resource?.projectId && resource.projectId !== ctx.projectId)
    throw new Error("The terminal resource belongs to another project.");
  const selected =
    input.workspaceId ??
    (resource?.type === "workspace" ? resource.id : undefined) ??
    (typeof resource?.metadata?.workspaceId === "string" ? resource.metadata.workspaceId : undefined) ??
    ctx.workspaceId;
  const workspace = selected ? await ctx.workspaces.get(selected) : await ctx.workspaces.getDefault();
  if (workspace?.projectId && workspace.projectId !== ctx.projectId)
    throw new Error("The terminal workspace belongs to another project.");
  if (
    workspace?.executionKind !== "local" ||
    workspace.providerState !== "ready" ||
    !workspace.rootPath ||
    workspace.device ||
    workspace.initializing ||
    workspace.setupError
  )
    throw new Error("A terminal requires a ready local workspace.");
  return workspace;
};

export const terminal = defineView({
  id: "terminal",
  title: l10n("terminal.title", "Terminal"),
  icon: "square-terminal",
  body: {
    kind: "terminal",
    resourceKind: terminalResource.ref,
    async session(ctx, { renderer }) {
      const workspace = await selectTerminalWorkspace(ctx, { resource: renderer.resource });
      return { workspaceId: workspace.id };
    },
  },
});

const openInWorkspace = async (ctx: ExtensionContextBase & { resource?: ResourceRef }, workspaceId?: string) => {
  const workspace = await selectTerminalWorkspace(ctx, { workspaceId, resource: ctx.resource });
  const identity = await ctx.resources.allocate({ kind: terminalResource.id });
  const index = identity.shorthand.match(/\d+$/)?.[0] ?? identity.shorthand;
  const resource: ResourceRef = {
    type: terminalResource.id,
    id: identity.id,
    shorthand: identity.shorthand,
    extensionId: ctx.extensionId,
    projectId: ctx.projectId,
    label: `Terminal ${index}`,
    icon: "square-terminal",
    metadata: { workspaceId: workspace.id },
  };
  await ctx.storage.set(`last-terminal:${workspace.id}`, resource);
  ctx.navigation.open({ kind: "panel", panel: terminalPlacement.ref, resource, open: "pin" });
  return resource;
};

export const openTerminal = defineCommand({
  id: "open",
  title: l10n("terminal.open", "Open terminal"),
  cli: true,
  palette: [{ group: "Terminal", icon: "square-terminal", params: {} }],
  async run(ctx) {
    ctx.signal.throwIfAborted();
    return openInWorkspace(ctx);
  },
});

export const openWorkspaceTerminal = defineCommand({
  id: "open-workspace",
  title: l10n("terminal.openWorkspace", "Open workspace terminal"),
  cli: true,
  params: { workspaceId: params.text({ required: true, resolvedFrom: "resource" }) },
  menus: [
    {
      slot: workspaceSlots.headerOverflow,
      label: l10n("terminal.open", "Open terminal"),
      icon: "square-terminal",
      when: {
        resourceType: [workbenchResourceKinds.workspace],
        metadata: { workspaceReadOnly: false, workspaceExecutionKind: "local", workspaceProviderState: "ready" },
      },
    },
  ],
  async run(ctx, input) {
    ctx.signal.throwIfAborted();
    return openInWorkspace(ctx, input.workspaceId);
  },
});

export const terminalPlacement = definePlacement({
  id: "terminal",
  mode: workbenchModes.project,
  region: "secondary",
  addableIn: ["main", "secondary", "side"],
  mountStrategy: "keep-mounted",
  hiddenByDefault: true,
  tab: { query: (_ctx, { renderer }) => ({ label: renderer.resource?.label ?? "Terminal" }) },
  item: {
    kind: "binding",
    binding: {
      kinds: [terminalResource.ref],
      view: terminal.ref,
      cardinality: "many",
      add: { kind: "command", target: { command: openTerminal.ref } },
    },
  },
});
