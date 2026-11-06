import type {
  ChatRendererSnapshot,
  ControlValueMap,
  ExtensionContextBase,
  ExtensionWorkspace,
} from "@pstdio/sdk/extensions";

export const workspacePresentation = async (
  ctx: ExtensionContextBase,
  selected: ExtensionWorkspace | undefined,
  input: { id?: string; locked?: boolean; available?: boolean; remote?: boolean } = {},
): Promise<NonNullable<ChatRendererSnapshot["workspace"]>> => {
  const summary =
    selected?.capabilities?.diff &&
    !selected.device &&
    selected.executionKind !== "remote" &&
    !selected.initializing &&
    !selected.setupError
      ? await ctx.workspaces.diffSummary(selected.id, "current").catch(() => undefined)
      : undefined;
  return {
    controlId: "workspace",
    deviceControlId: "device",
    ...(!input.locked
      ? {
          create: {
            actionId: "create-workspace",
            ...(input.remote
              ? { disabledReason: "Create a workspace on its owning device, then select it here." }
              : {}),
          },
        }
      : {}),
    ...(selected?.setupError ? { status: "error", statusLabel: selected.setupError } : {}),
    ...(selected?.initializing ? { status: "loading" } : {}),
    additions: summary?.additions ?? 0,
    deletions: summary?.deletions ?? 0,
    ...(input.id &&
    selected?.id === input.id &&
    input.available !== false &&
    !selected.initializing &&
    !selected.setupError
      ? { openResourceId: input.id }
      : {}),
  };
};

/** Public workspace creation is local. Never silently create for a different selected account device. */
export const createDraftWorkspace = async (ctx: ExtensionContextBase, values: ControlValueMap) => {
  if (typeof values.device === "string" && values.device) {
    const device = (await ctx.account.devices()).find((device) => device.id === values.device);
    if (!device?.current) throw new Error("Create a workspace on its owning device, then select it here.");
  }
  const workspace = values.workspace;
  if (!workspace || typeof workspace !== "object" || !("providerId" in workspace) || !workspace.providerId)
    throw new Error("Choose a workspace type.");
  // The public lifecycle validates the provider's schema and owns setup, limits and execution target.
  return ctx.workspaces.create({ providerId: workspace.providerId, params: workspace.params });
};

export const savedWorkspaceControls = (
  id: string | undefined,
  workspace: ExtensionWorkspace | undefined,
  device: ExtensionWorkspace["device"],
): NonNullable<ChatRendererSnapshot["controls"]> => [
  {
    id: "workspace",
    name: "Workspace",
    type: "selection",
    defaultValue: id ?? "",
    readOnly: true,
    options: id ? [{ id, name: workspace?.name ?? workspace?.shorthand ?? id }] : [],
  },
  {
    id: "device",
    name: "Device",
    type: "selection",
    defaultValue: device?.id ?? "",
    readOnly: true,
    options: [{ id: device?.id ?? "", name: device?.name ?? "This device" }],
  },
];
export const isWorkspaceCreation = (values: ControlValueMap) => {
  const value = values.workspace;
  return Boolean(value && typeof value === "object" && "providerId" in value);
};
export const draftWorkspacePresentation = (
  ctx: ExtensionContextBase,
  selected: ExtensionWorkspace | undefined,
  input: { id: string; creating: boolean; remote: boolean; online?: boolean },
) =>
  workspacePresentation(ctx, input.creating ? undefined : selected, {
    id: input.creating ? undefined : input.id || undefined,
    remote: input.remote,
    available: !input.remote || input.online,
  });
