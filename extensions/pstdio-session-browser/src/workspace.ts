import type { ChatRendererSnapshot, ExtensionContextBase, ExtensionWorkspace } from "@pstdio/sdk/extensions";

export const workspacePresentation = async (
  ctx: ExtensionContextBase,
  selected: ExtensionWorkspace | undefined,
  input: { id?: string; existingSession?: boolean; available?: boolean } = {},
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
    ...(selected?.setupError ? { status: "error", statusLabel: selected.setupError } : {}),
    ...(selected?.initializing ? { status: "loading" } : {}),
    additions: summary?.additions ?? 0,
    deletions: summary?.deletions ?? 0,
    ...(input.existingSession &&
    input.id &&
    selected?.id === input.id &&
    input.available !== false &&
    !selected.initializing &&
    !selected.setupError
      ? { openResourceId: input.id }
      : {}),
  };
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
