import { HStack } from "@chakra-ui/react";
import type { ChatDraft, ChatRendererSnapshot, ControlValueMap, SelectionControl } from "@pstdio/sdk/extensions";
import { ChatDeviceMenu, ChatWorkspaceHub, ChatWorkspaceMenu } from "@pstdio/ui/chat-ui";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import { NativeChatResources } from "./native-chat-status";

export interface NativeChatWorkspaceProps {
  conversation: ChatRendererSnapshot;
  draft: ChatDraft;
  initializing?: boolean;
  run: ChatSession["run"];
  /** Native owner updates synchronously; command dispatch follows the accepted local edit. */
  changeValues(values: ControlValueMap | ((current: ControlValueMap) => ControlValueMap)): void;
}

const workspaceLabel = (workspace: SelectionControl, value: unknown) => {
  return workspace.options.find((option) => option.id === value)?.name ?? workspace.placeholder ?? "Select workspace";
};

// Metadata can arrive before the current local selection settles.
const selectedWorkspaceId = (
  workspace: NonNullable<ChatRendererSnapshot["controls"]>[number] | undefined,
  value: unknown,
  openId?: string,
) =>
  typeof value === "string" &&
  value !== "" &&
  value === openId &&
  workspace?.type === "selection" &&
  workspace.options?.some((option) => option.id === value)
    ? value
    : undefined;

/** Selection IDs and provider values remain in the native owner's one draft map. */
export const NativeChatWorkspace = (props: NativeChatWorkspaceProps) => {
  const { conversation, draft, initializing, run, changeValues } = props;
  const binding = conversation.workspace;
  if (!binding) return <NativeChatResources resources={conversation.resources} run={run} />;
  const workspace = conversation.controls?.find((control) => control.id === binding.controlId);
  const device = conversation.controls?.find((control) => control.id === binding.deviceControlId);
  const locked = Boolean(conversation.readOnly || initializing);
  const change = (id: string, value: ControlValueMap[string]) => {
    let values = draft.values;
    changeValues((current) => {
      values = { ...current, [id]: value };
      // Changing machines invalidates the workspace in the same local edit/clock.
      if (id === binding.deviceControlId) values[binding.controlId] = "";
      return values;
    });
    void run({ type: "control", id, values }).catch(() => undefined);
  };
  const selectedId =
    workspace?.type === "selection" ? (draft.values[workspace.id] ?? workspace.defaultValue) : undefined;
  const openId = selectedWorkspaceId(workspace, selectedId, binding.openResourceId);
  return (
    <>
      <ChatWorkspaceHub
        workspaceControl={
          <HStack gap="2xs" minW="0">
            {device?.type === "selection" && (device.options.length > 1 || device.readOnly) && (
              <ChatDeviceMenu
                devices={device.options.map((option) => ({ ...option, current: option.id === "" }))}
                selectedDeviceId={String(draft.values[device.id] ?? device.defaultValue ?? "")}
                isDisabled={locked || Boolean(device.readOnly || device.disabled)}
                onSelectDevice={(value) => change(device.id, value)}
              />
            )}
            {workspace?.type === "selection" && (
              <ChatWorkspaceMenu
                workspaces={workspace.options.map((option) => ({
                  id: option.id,
                  title: option.name,
                  shorthand: option.description,
                  disabled: option.disabled,
                }))}
                selectedWorkspaceId={typeof selectedId === "string" ? selectedId : ""}
                selectedWorkspaceLabel={workspaceLabel(workspace, selectedId)}
                isDisabled={locked || Boolean(workspace.readOnly || workspace.disabled)}
                onSelectWorkspace={(value) => change(workspace.id, value)}
                onOpenWorkspace={
                  openId ? () => void run({ type: "openResource", id: openId }).catch(() => undefined) : undefined
                }
              />
            )}
          </HStack>
        }
        additions={binding.additions ?? 0}
        deletions={binding.deletions ?? 0}
        status={binding.status}
        statusLabel={binding.statusLabel}
      />
      <NativeChatResources resources={conversation.resources} run={run} />
    </>
  );
};
