import { Box, Button, Text } from "@chakra-ui/react";
import { MenuItem, SearchableMenu, type SearchableMenuItem, Tooltip } from "@pstdio/ui";
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

type ProjectsTranslate = (key: string) => string;

interface WorkspaceAgentMenuProps {
  agentOptions: AgentMenuOption[];
  selectedAgent: string;
  onSelectAgent: (agent: string) => void;
  modelOptions: WorkspacePanelMenuOption[];
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isDisabled?: boolean;
  isAgentSwitchDisabled?: boolean;
  isAgentsLoading?: boolean;
  isModelsLoading?: boolean;
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
  t: ProjectsTranslate,
): SearchableMenuItem[] => {
  if (isAgentsLoading) {
    return [{ id: "agent-loading", label: t("chatInput.agent.loading"), icon: TerminalIcon, isDisabled: true }];
  }

  if (agentOptions.length === 0) {
    return [{ id: "agent-none-available", label: t("chatInput.agent.unknown"), icon: TerminalIcon, isDisabled: true }];
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
  t: ProjectsTranslate,
): SearchableMenuItem[] => {
  if (isModelsLoading) {
    return [{ id: "model-loading", label: t("chatInput.model.loading"), icon: Cpu, isDisabled: true }];
  }

  if (modelOptions.length === 0) {
    return [{ id: "model-none-available", label: t("chatInput.model.noneAvailable"), icon: Cpu, isDisabled: true }];
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
    isAgentsLoading = false,
    isModelsLoading = false,
  } = props;
  const { t } = useTranslation("projects");

  const selectedAgentLabel = isAgentsLoading
    ? t("chatInput.agent.loading")
    : getSelectedLabel(agentOptions, selectedAgent, t("chatInput.agent.selectLabel"), t("chatInput.agent.unknown"));
  const selectedModelLabel = isModelsLoading
    ? t("chatInput.model.loading")
    : getSelectedLabel(modelOptions, selectedModel, t("chatInput.model.selectLabel"), t("chatInput.model.none"));
  const isSwitchDisabled = isDisabled || isAgentSwitchDisabled || agentOptions.length <= 1;
  const isMenuDisabled = isDisabled || (agentOptions.length === 0 && modelOptions.length === 0);
  const agentMenuItems = buildAgentMenuItems(agentOptions, selectedAgent, isAgentsLoading, t);
  const modelMenuItems = buildModelMenuItems(modelOptions, selectedModel, isModelsLoading, onSelectModel, t);

  return (
    <SearchableMenu
      trigger={
        <Box>
          <Tooltip content={isMenuDisabled ? t("chatInput.model.noneAvailable") : t("chatInput.model.selectLabel")}>
            <Button
              variant="ghost"
              size="sm"
              px="2"
              aria-label={t("chatInput.model.selectLabel")}
              disabled={isMenuDisabled}
            >
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
      searchPlaceholder={t("chatInput.model.searchPlaceholder")}
      contentTestId="workspace-agent-model-options"
      emptyState={<MenuItem primaryLabel={t("chatInput.model.noneAvailable")} leftIcon={Cpu} isDisabled />}
      parentList={{
        items: agentMenuItems,
        selectedLabel: selectedAgentLabel,
        selectedIcon: TerminalIcon,
        ariaLabel: t("chatInput.agent.selectLabel"),
        disabled: isSwitchDisabled,
        showSearch: false,
        contentTestId: "workspace-agent-options",
        emptyState: <MenuItem primaryLabel={t("chatInput.agent.unknown")} leftIcon={TerminalIcon} isDisabled />,
        onSelect: (item) => {
          if (agentOptions.find((o) => o.value === item.id)?.disabled) return;
          onSelectAgent(item.id);
        },
      }}
    />
  );
};
