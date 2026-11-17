import { Box, Button, Icon, Menu, Text } from "@chakra-ui/react";
import { ChevronDown, Cpu, TerminalIcon } from "lucide-react";
import { ListRow } from "../list-row/list-row";
import { SearchableMenu, type SearchableMenuItem } from "../overlays/searchable-menu";
import { Tooltip } from "../primitives/tooltip";
import { moveSelectedModelFirst } from "./model-option-order";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number }>;
}

interface AgentMenuOption extends WorkspacePanelMenuOption {
  disabled?: boolean;
}

interface HarnessModelMenuLabels {
  agentSelect: string;
  agentUnknown: string;
  agentLoading: string;
  modelSelect: string;
  modelNone: string;
  modelNoneAvailable: string;
  modelLoading: string;
  modelSearchPlaceholder: string;
}

export interface HarnessModelMenuProps {
  agentOptions: AgentMenuOption[];
  selectedAgent: string;
  onSelectAgent: (agent: string) => void;
  modelOptions: WorkspacePanelMenuOption[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  /** False when the selected harness offers no model choice; the menu then picks the agent only. */
  offersModels?: boolean;
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
  shouldDisableSingleAgentSwitch?: boolean;
  isAgentsLoading?: boolean;
  isModelsLoading?: boolean;
  labels?: Partial<HarnessModelMenuLabels>;
  portalled?: boolean;
  size?: "2xs" | "xs" | "sm";
}

const getSelectedLabel = (
  options: WorkspacePanelMenuOption[],
  value: string,
  selectLabel: string,
  fallback: string,
) => {
  if (!value) return selectLabel;
  return options.find((o) => o.value === value)?.label ?? fallback;
};

const buildAgentMenuItems = (
  agentOptions: AgentMenuOption[],
  selectedAgent: string,
  isAgentsLoading: boolean,
  labels: HarnessModelMenuLabels,
): SearchableMenuItem[] => {
  if (isAgentsLoading) {
    return [{ id: "agent-loading", label: labels.agentLoading, icon: TerminalIcon, isDisabled: true }];
  }

  if (agentOptions.length === 0) {
    return [{ id: "agent-none-available", label: labels.agentUnknown, icon: TerminalIcon, isDisabled: true }];
  }

  return agentOptions.map((option) => ({
    id: option.value,
    label: option.label,
    searchText: option.value,
    // An unavailable harness says why, such as a missing or too-old CLI.
    secondaryLabel: option.description,
    icon: option.icon ?? TerminalIcon,
    isSelected: option.value === selectedAgent,
    isDisabled: option.disabled,
  }));
};

const buildModelMenuItems = (
  modelOptions: WorkspacePanelMenuOption[],
  selectedModel: string,
  isModelsLoading: boolean,
  disabled: boolean,
  onSelectModel: (model: string) => void,
  labels: HarnessModelMenuLabels,
): SearchableMenuItem[] => {
  if (isModelsLoading) {
    return [{ id: "model-loading", label: labels.modelLoading, icon: Cpu, isDisabled: true }];
  }

  return moveSelectedModelFirst(modelOptions, (option) => option.value === selectedModel).map((option) => ({
    id: option.value,
    label: option.label,
    secondaryLabel: option.description,
    searchText: `${option.value} ${option.description ?? ""}`,
    isSelected: option.value === selectedModel,
    isDisabled: disabled,
    onSelect: () => {
      if (!disabled) onSelectModel(option.value);
    },
  }));
};

interface MenuTriggerButtonProps {
  label: string;
  ariaLabel: string;
  tooltip: string;
  disabled: boolean;
  icon?: WorkspacePanelMenuOption["icon"];
  size: NonNullable<HarnessModelMenuProps["size"]>;
}

const MenuTriggerButton = (props: MenuTriggerButtonProps) => {
  const { label, ariaLabel, tooltip, disabled, icon, size } = props;
  return (
    <Tooltip content={tooltip}>
      <Button variant="ghost" size={size} px="2" aria-label={ariaLabel} disabled={disabled}>
        {icon ? <Icon as={icon} boxSize="14px" color="fg.muted" flexShrink={0} /> : null}
        <Text textStyle="label/XS/medium" color="fg">
          {label}
        </Text>
        <ChevronDown size={14} />
      </Button>
    </Tooltip>
  );
};

export const HarnessModelMenu = (props: HarnessModelMenuProps) => {
  const {
    agentOptions,
    selectedAgent,
    onSelectAgent,
    modelOptions,
    selectedModel,
    onSelectModel,
    offersModels = true,
    isDisabled = false,
    isAgentSwitchDisabled = false,
    shouldDisableSingleAgentSwitch = true,
    isAgentsLoading = false,
    isModelsLoading = false,
    labels,
    portalled = true,
    size = "sm",
  } = props;
  const resolvedLabels = {
    agentSelect: labels?.agentSelect ?? "Select harness",
    agentUnknown: labels?.agentUnknown ?? "No harness available",
    agentLoading: labels?.agentLoading ?? "Loading harnesses...",
    modelSelect: labels?.modelSelect ?? "Select model",
    modelNone: labels?.modelNone ?? "No models",
    modelNoneAvailable: labels?.modelNoneAvailable ?? "No models available",
    modelLoading: labels?.modelLoading ?? "Loading models...",
    modelSearchPlaceholder: labels?.modelSearchPlaceholder ?? "Search models…",
  };

  const selectedAgentIcon = agentOptions.find((option) => option.value === selectedAgent)?.icon ?? TerminalIcon;
  const agentLabel =
    agentOptions.length === 0
      ? resolvedLabels.agentUnknown
      : getSelectedLabel(agentOptions, selectedAgent, resolvedLabels.agentSelect, resolvedLabels.agentUnknown);
  const selectedAgentLabel = isAgentsLoading ? resolvedLabels.agentLoading : agentLabel;
  const selectedModelLabel = isModelsLoading
    ? resolvedLabels.modelLoading
    : getSelectedLabel(modelOptions, selectedModel, resolvedLabels.modelSelect, resolvedLabels.modelNone);
  const isSwitchDisabled =
    isDisabled || isAgentSwitchDisabled || (shouldDisableSingleAgentSwitch && agentOptions.length <= 1);
  const isMenuDisabled = isDisabled || (agentOptions.length === 0 && modelOptions.length === 0);
  const agentMenuItems = buildAgentMenuItems(agentOptions, selectedAgent, isAgentsLoading, resolvedLabels);
  const modelMenuItems = buildModelMenuItems(
    modelOptions,
    selectedModel,
    isModelsLoading,
    isDisabled,
    onSelectModel,
    resolvedLabels,
  );
  const agentEmptyState = (
    <Menu.Item value="empty" asChild>
      <ListRow
        asChild
        variant="compact"
        id="empty"
        label={resolvedLabels.agentUnknown}
        icon={<Icon as={TerminalIcon} boxSize="16px" />}
        disabled
      />
    </Menu.Item>
  );
  if (!offersModels) {
    if (isAgentSwitchDisabled) return null;
    return (
      <SearchableMenu
        fixedHeight
        trigger={
          // Menu.Trigger passes its props to this direct child, so it must stay a DOM element.
          <Box>
            <MenuTriggerButton
              label={selectedAgentLabel}
              ariaLabel={resolvedLabels.agentSelect}
              tooltip={resolvedLabels.agentSelect}
              disabled={isSwitchDisabled}
              icon={selectedAgentIcon}
              size={size}
            />
          </Box>
        }
        items={agentMenuItems.map((item) => ({
          ...item,
          isDisabled: isSwitchDisabled || item.isDisabled,
          onSelect: () => {
            if (!isSwitchDisabled && !item.isDisabled) onSelectAgent(item.id);
          },
        }))}
        showSearch={false}
        width="260px"
        portalled={portalled}
        searchPlaceholder={resolvedLabels.modelSearchPlaceholder}
        contentTestId="workspace-agent-options"
        emptyState={agentEmptyState}
      />
    );
  }

  return (
    <SearchableMenu
      fixedHeight
      trigger={
        <Box>
          <MenuTriggerButton
            label={selectedModelLabel}
            ariaLabel={resolvedLabels.modelSelect}
            tooltip={isMenuDisabled ? resolvedLabels.modelNoneAvailable : resolvedLabels.modelSelect}
            disabled={isMenuDisabled}
            icon={selectedAgentIcon}
            size={size}
          />
        </Box>
      }
      items={modelMenuItems}
      showSearch={modelOptions.length > 5}
      width="260px"
      portalled={portalled}
      searchPlaceholder={resolvedLabels.modelSearchPlaceholder}
      contentTestId="workspace-agent-model-options"
      emptyState={
        <Menu.Item value="empty" asChild>
          <ListRow
            asChild
            variant="compact"
            id="empty"
            label={resolvedLabels.modelNoneAvailable}
            icon={<Icon as={Cpu} boxSize="16px" />}
            disabled
          />
        </Menu.Item>
      }
      parentList={{
        items: agentMenuItems,
        selectedLabel: selectedAgentLabel,
        selectedIcon: selectedAgentIcon,
        ariaLabel: resolvedLabels.agentSelect,
        disabled: isSwitchDisabled,
        showSearch: false,
        contentTestId: "workspace-agent-options",
        emptyState: agentEmptyState,
        onSelect: (item) => {
          if (isSwitchDisabled || agentOptions.find((o) => o.value === item.id)?.disabled) return;
          onSelectAgent(item.id);
        },
      }}
    />
  );
};
