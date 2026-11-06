import { Box, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import type { ChatDraft, ChatRendererSnapshot, ControlValueMap, SelectionControl } from "@pstdio/sdk/extensions";
import { resolveIconComponent, SearchableMenu, Tooltip } from "@pstdio/ui";
import { ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { ArrowUpRight, ChevronDown, Folder, Monitor, Plus } from "lucide-react";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { NativeChatResources } from "./native-chat-status";
import { NativeWorkspaceCreation } from "./native-chat-workspace-creation";

export interface NativeChatWorkspaceProps {
  conversation: ChatRendererSnapshot;
  draft: ChatDraft;
  initializing?: boolean;
  renderParamField?: CommandParamFieldRenderer;
  run: ChatSession["run"];
  currentValues?(): ControlValueMap;
  /** Native owner updates synchronously; command dispatch follows the accepted local edit. */
  changeValues(values: ControlValueMap | ((current: ControlValueMap) => ControlValueMap)): void;
}

const WorkspaceSelection = (props: {
  control: SelectionControl;
  value: unknown;
  disabled: boolean;
  device?: boolean;
  create?: { disabledReason?: string };
  change(value: string | { providerId: string; params: Record<string, never> }): void;
}) => {
  const { control, value, disabled, device, create, change } = props;
  const selected = control.options.find((option) => option.id === value);
  const Fallback = device ? Monitor : Folder;
  const Glyph = (selected?.icon && resolveIconComponent(selected.icon)) || Fallback;
  const creating = typeof value === "object" && value !== null;
  return (
    <SearchableMenu
      trigger={
        <Box minW="0">
          <Button
            variant="ghost"
            size="xs"
            px="2xs"
            minW="0"
            aria-label={`Select ${control.name.toLowerCase()}`}
            disabled={disabled}
          >
            <Glyph size={14} />
            <Text textStyle="label/XS/medium" truncate>
              {creating ? "New workspace" : (selected?.name ?? control.placeholder ?? control.name)}
            </Text>
            {!disabled && <ChevronDown size={14} />}
          </Button>
        </Box>
      }
      items={[
        ...control.options.map((option) => ({
          id: option.id,
          label: option.name,
          secondaryLabel: option.description,
          icon: (option.icon && resolveIconComponent(option.icon)) || Fallback,
          isSelected: value === option.id,
          isDisabled: disabled || option.disabled,
          onSelect: () => {
            if (!disabled && !option.disabled) change(option.id);
          },
        })),
        ...(create
          ? [
              {
                id: "native-create-workspace",
                label: "New workspace",
                icon: Plus,
                isDisabled: disabled || Boolean(create.disabledReason),
                secondaryLabel: create.disabledReason,
                onSelect: () => {
                  if (!disabled && !create.disabledReason) change({ providerId: "", params: {} });
                },
              },
            ]
          : []),
      ]}
      searchPlaceholder={`Search ${control.name.toLowerCase()}...`}
      emptyState={<Text>No choices available</Text>}
      showSearch={control.options.length > 10}
      portalled
    />
  );
};

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
  return (
    <>
      <ChatWorkspaceHub
        workspaceControl={
          <HStack gap="2xs" minW="0">
            {device?.type === "selection" && (
              <WorkspaceSelection
                control={device}
                device
                value={draft.values[device.id] ?? device.defaultValue}
                disabled={locked || Boolean(device.readOnly || device.disabled)}
                change={(value) => change(device.id, value)}
              />
            )}
            {workspace?.type === "selection" && (
              <WorkspaceSelection
                control={workspace}
                value={draft.values[workspace.id] ?? workspace.defaultValue}
                disabled={locked || Boolean(workspace.readOnly || workspace.disabled)}
                create={binding.create}
                change={(value) => change(workspace.id, value)}
              />
            )}
          </HStack>
        }
        additions={binding.additions ?? 0}
        deletions={binding.deletions ?? 0}
        status={binding.status}
        statusLabel={binding.statusLabel}
        action={
          binding.openResourceId ? (
            <Tooltip content="Open workspace">
              <IconButton
                aria-label="Open workspace"
                size="xs"
                variant="ghost"
                onClick={() => void run({ type: "openResource", id: binding.openResourceId! }).catch(() => undefined)}
              >
                <ArrowUpRight size={14} />
              </IconButton>
            </Tooltip>
          ) : undefined
        }
        options={
          <NativeWorkspaceCreation
            {...props}
            disabled={locked || Boolean(workspace?.readOnly || (workspace?.type === "selection" && workspace.disabled))}
          />
        }
      />
      <NativeChatResources resources={conversation.resources} run={run} />
    </>
  );
};
