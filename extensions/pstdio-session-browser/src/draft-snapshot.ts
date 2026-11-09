import type { ChatRendererSnapshot, ControlValueMap, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { commandDraftTag, commandIntent, commandSuggestions } from "./command-intent";
import { composerControls, conversationOperations } from "./controls";
import { readDraft } from "./drafts";
import { selectedHarness, selectedWorkspace } from "./selection";
import { workspaceSnapshot } from "./workspace";

const initialDraftValues = (resource: ResourceRef | undefined, saved: ControlValueMap, override?: ControlValueMap) => ({
  harness: { harnessId: typeof resource?.metadata?.agent === "string" ? resource.metadata.agent : "" },
  ...(typeof resource?.metadata?.workspaceId === "string" ? { workspace: resource.metadata.workspaceId } : {}),
  device: typeof resource?.metadata?.deviceId === "string" ? resource.metadata.deviceId : "",
  ...saved,
  ...override,
});

export const draftSnapshot = async (
  ctx: ExtensionContextBase,
  resource?: ResourceRef,
  override?: ControlValueMap,
): Promise<ChatRendererSnapshot> => {
  const [saved, allWorkspaces, devices] = await Promise.all([
    readDraft(ctx, resource?.id ?? "draft"),
    ctx.workspaces.list(),
    ctx.account.devices().catch(() => []),
  ]);
  const values: ControlValueMap = initialDraftValues(resource, saved.values, override);
  const deviceId = typeof values.device === "string" ? values.device : "";
  const device = devices.find((device) => device.id === deviceId);
  const remote = Boolean(deviceId && !device?.current);
  if (device?.current) values.device = "";
  const workspaces = allWorkspaces.filter((workspace) =>
    remote ? workspace.device?.id === deviceId : !workspace.device,
  );
  const selected = selectedWorkspace(values);
  const workspace =
    workspaces.find((workspace) => workspace.id === selected)?.id ??
    workspaces.find((workspace) => workspace.isDefault)?.id ??
    workspaces[0]?.id ??
    "";
  values.workspace = workspace;
  const controls: NonNullable<ChatRendererSnapshot["controls"]> = [
    ...composerControls.map((control) => ({ ...control, readOnly: remote })),
    {
      id: "workspace",
      name: "Workspace",
      type: "selection",
      defaultValue: workspace,
      options: workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name ?? workspace.shorthand ?? workspace.id,
        description: [workspace.shorthand, workspace.branch].filter(Boolean).join(" "),
        disabled: Boolean(workspace.setupError || workspace.initializing),
      })),
    },
    {
      id: "device",
      name: "Device",
      type: "selection",
      defaultValue: "",
      options: [
        { id: "", name: "This device" },
        ...devices
          .filter((device) => !device.current)
          .map((device) => ({ id: device.id, name: device.name, disabled: !device.online })),
      ],
    },
  ];
  const harness = selectedHarness(values);
  const commands =
    !remote && harness
      ? await ctx.sessions.getDraftHarnessCommands({ harness, workspaceId: workspace || undefined })
      : undefined;
  let notice = "";
  if (remote)
    notice = device?.online
      ? `New work will run on ${device.name}.`
      : `${device?.name ?? deviceId} is offline. Reconnect it before sending.`;
  return {
    nativeLinks: true,
    nativeHarnessAccount: { controlId: "harness", ...(remote ? { remote: true } : {}) },
    workspaceId: workspace || undefined,
    ...(await workspaceSnapshot(ctx, controls, {
      id: workspace || undefined,
      available: !remote || device?.online,
    })),
    operations: conversationOperations(remote, false),
    values,
    harness: commands && commandSuggestions(commands, commandIntent(values)),
    draftTag: commandDraftTag(values, harness?.harnessId ?? "", commands),
    submitDisabled: Boolean(remote && !device?.online),
    notice,
  };
};
