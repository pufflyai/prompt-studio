import { Box, Button, Icon, Menu, Text } from "@chakra-ui/react";
import { ListRow, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, Cpu, TerminalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

interface AgentMenuOption extends WorkspacePanelMenuOption {
  disabled?: boolean;
}

interface WorkspaceAgentMenuLabels {
  agentSelect: string;
  agentUnknown: string;
  agentLoading: string;
  modelSelect: string;
  modelNone: string;
  modelNoneAvailable: string;
  modelLoading: string;
  modelSearchPlaceholder: string;
}

interface WorkspaceAgentMenuProps {
  agentOptions: AgentMenuOption[];
  selectedAgent: string;
  onSelectAgent: (agent: string) => void;
  modelOptions: WorkspacePanelMenuOption[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
  shouldDisableSingleAgentSwitch?: boolean;
  isAgentsLoading?: boolean;
  isModelsLoading?: boolean;
  labels?: Partial<WorkspaceAgentMenuLabels>;
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
  labels: WorkspaceAgentMenuLabels,
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
    icon: option.icon ?? TerminalIcon,
    isSelected: option.value === selectedAgent,
    isDisabled: option.disabled,
  }));
};

const buildModelMenuItems = (
  modelOptions: WorkspacePanelMenuOption[],
  selectedModel: string,
  isModelsLoading: boolean,
  onSelectModel: (model: string) => void,
  labels: WorkspaceAgentMenuLabels,
): SearchableMenuItem[] => {
  if (isModelsLoading) {
    return [{ id: "model-loading", label: labels.modelLoading, icon: Cpu, isDisabled: true }];
  }

  if (modelOptions.length === 0) {
    return [{ id: "model-none-available", label: labels.modelNoneAvailable, icon: Cpu, isDisabled: true }];
  }

  return modelOptions.map((option) => ({
    id: option.value,
    label: option.label,
    searchText: option.value,
    isSelected: option.value === selectedModel,
    onSelect: () => onSelectModel(option.value),
  }));
};

export const WorkspaceAgentMenu = (props: WorkspaceAgentMenuProps) => {
  const {
    agentOptions,
    selectedAgent,
    onSelectAgent,
    modelOptions,
    selectedModel,
    onSelectModel,
    isDisabled = false,
    isAgentSwitchDisabled = false,
    shouldDisableSingleAgentSwitch = true,
    isAgentsLoading = false,
    isModelsLoading = false,
    labels,
  } = props;
  const { t } = useTranslation("projects");
  const resolvedLabels = {
    agentSelect: labels?.agentSelect ?? t("chatInput.agent.selectLabel"),
    agentUnknown: labels?.agentUnknown ?? t("chatInput.agent.unknown"),
    agentLoading: labels?.agentLoading ?? t("chatInput.agent.loading"),
    modelSelect: labels?.modelSelect ?? t("chatInput.model.selectLabel"),
    modelNone: labels?.modelNone ?? t("chatInput.model.none"),
    modelNoneAvailable: labels?.modelNoneAvailable ?? t("chatInput.model.noneAvailable"),
    modelLoading: labels?.modelLoading ?? t("chatInput.model.loading"),
    modelSearchPlaceholder: labels?.modelSearchPlaceholder ?? t("chatInput.model.searchPlaceholder"),
  };

  const selectedAgentLabel = isAgentsLoading
    ? resolvedLabels.agentLoading
    : getSelectedLabel(agentOptions, selectedAgent, resolvedLabels.agentSelect, resolvedLabels.agentUnknown);
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
    onSelectModel,
    resolvedLabels,
  );

  return (
    <SearchableMenu
      trigger={
        <Box>
          <Tooltip content={isMenuDisabled ? resolvedLabels.modelNoneAvailable : resolvedLabels.modelSelect}>
            <Button variant="ghost" size="sm" px="2" aria-label={resolvedLabels.modelSelect} disabled={isMenuDisabled}>
              <Text textStyle="label/XS/medium" color="fg">
                {selectedModelLabel}
              </Text>
              <ChevronDown size={14} />
            </Button>
          </Tooltip>
        </Box>
      }
      items={modelMenuItems}
      showSearch={modelOptions.length > 5}
      width="260px"
      portalled={false}
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
        selectedIcon: TerminalIcon,
        ariaLabel: resolvedLabels.agentSelect,
        disabled: isSwitchDisabled,
        showSearch: false,
        contentTestId: "workspace-agent-options",
        emptyState: (
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
        ),
        onSelect: (item) => {
          if (agentOptions.find((o) => o.value === item.id)?.disabled) return;
          onSelectAgent(item.id);
        },
      }}
    />
  );
};
