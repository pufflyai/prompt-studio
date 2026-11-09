import type {
  ChatRendererSnapshot,
  CommandOutcome,
  ExtensionContextBase,
  ExtensionWorkspace,
} from "@pstdio/sdk/extensions";
import { workspacePages } from "@pstdio/sdk/extensions";

type WorkspacePresentation = NonNullable<ChatRendererSnapshot["workspace"]>;
type WorkspacePresentationInput = { id?: string; existingSession?: boolean; available?: boolean };

export const workspaceSnapshot = async (
  ctx: ExtensionContextBase,
  controls: NonNullable<ChatRendererSnapshot["controls"]>,
  input: WorkspacePresentationInput = {},
) => {
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
    controls: outcome?.ok ? controls : controls.filter((control) => control.id !== "workspace"),
    workspace: outcome?.ok ? outcome.value : { controlId: "workspace", deviceControlId: "device" },
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
