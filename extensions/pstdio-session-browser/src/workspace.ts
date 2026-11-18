import type {
  ChatRendererSnapshot,
  CommandOutcome,
  ExtensionContextBase,
  ExtensionWorkspace,
} from "@pstdio/sdk/extensions";
import { workspacePages } from "@pstdio/sdk/extensions";

export const workspaceUnavailableReason = (workspace?: ExtensionWorkspace) => {
  if (workspace?.setupError) return "Workspace setup failed. Choose another workspace or check its setup.";
  const state = workspace?.providerState;
  if (workspace?.initializing || state === "provisioning") return "Workspace setup is in progress.";
  if (state && state !== "ready") return "Workspace unavailable. Choose another workspace or check its status.";
};

type WorkspacePresentation = NonNullable<ChatRendererSnapshot["workspace"]>;
type WorkspacePresentationInput = { id?: string; existingSession?: boolean; available?: boolean };

export const readWorkspacePresentation = async (ctx: ExtensionContextBase, input: WorkspacePresentationInput = {}) => {
  // Workspaces owns this optional presentation. Missing or failed tools must not stop the conversation.
  let outcome: CommandOutcome<WorkspacePresentation> | undefined;
  try {
    outcome = await ctx.commands.execute<WorkspacePresentationInput, WorkspacePresentation>(
      { kind: "command", extensionId: workspacePages.workspace.extensionId, id: "session-presentation" },
      { params: input },
    );
  } catch {
    // The optional tool may be unavailable while its runtime is loading or shutting down.
  }
  return {
    available: Boolean(outcome?.ok),
    workspace: outcome?.ok ? outcome.value : { controlId: "workspace", deviceControlId: "device" },
  };
};

export const withWorkspaceControls = (
  controls: NonNullable<ChatRendererSnapshot["controls"]>,
  presentation: Awaited<ReturnType<typeof readWorkspacePresentation>>,
) => ({
  controls: presentation.available ? controls : controls.filter((control) => control.id !== "workspace"),
  workspace: presentation.workspace,
});

export const workspaceSnapshot = async (
  ctx: ExtensionContextBase,
  controls: NonNullable<ChatRendererSnapshot["controls"]>,
  input: WorkspacePresentationInput = {},
) => withWorkspaceControls(controls, await readWorkspacePresentation(ctx, input));

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
