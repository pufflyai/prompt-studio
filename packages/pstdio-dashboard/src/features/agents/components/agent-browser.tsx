import { Box, Button, HStack, Menu, Text } from "@chakra-ui/react";
import { MenuItem, Tooltip } from "@pstdio/ui";
import { ChevronDown, Cpu, Repeat, TerminalIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface WorkspacePanelMenuOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ size?: number }>;
}

interface AgentMenuOption extends WorkspacePanelMenuOption {
  disabled?: boolean;
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
  } = props;
  const { t } = useTranslation("projects");

  const selectedAgentLabel = getSelectedLabel(
    agentOptions,
    selectedAgent,
    t("chatInput.agent.selectLabel"),
    t("chatInput.agent.unknown"),
  );
  const selectedModelLabel = getSelectedLabel(
    modelOptions,
    selectedModel,
    t("chatInput.model.selectLabel"),
    t("chatInput.model.none"),
  );
  const isSwitchDisabled = isDisabled || isAgentSwitchDisabled || agentOptions.length <= 1;
  const isMenuDisabled = isDisabled || (agentOptions.length === 0 && modelOptions.length === 0);
  const defaultMenuContent = modelOptions.length > 0 ? "models" : "agents";
  const [menuContent, setMenuContent] = useState<"models" | "agents">(defaultMenuContent);
  const isShowingAgents = menuContent === "agents";

  return (
    <Menu.Root lazyMount={false}>
      <Menu.Trigger asChild>
        <Box>
          <Tooltip content={isMenuDisabled ? t("chatInput.model.noneAvailable") : t("chatInput.model.selectLabel")}>
            <Button
              variant="ghost"
              size="sm"
              px="2"
              aria-label={t("chatInput.model.selectLabel")}
              disabled={isMenuDisabled}
              onClick={() => setMenuContent(defaultMenuContent)}
            >
              <Text textStyle="label/XS/medium" color="foreground.primary">
                {selectedModelLabel}
              </Text>
              <ChevronDown size={14} />
            </Button>
          </Tooltip>
        </Box>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="260px" bg="background.primary" p="0">
          <HStack justify="space-between" alignItems="center" px="sm" py="xs" gap="xs">
            <HStack gap="xs" minW="0" color="foreground.secondary">
              <TerminalIcon size={16} />
              <Text textStyle="label/XS/medium" lineClamp={1}>
                {selectedAgentLabel}
              </Text>
            </HStack>
            <Tooltip content={t("chatInput.agent.selectLabel")}>
              <Button
                variant="ghost"
                size="xs"
                minW="1.5rem"
                h="1.5rem"
                px="1"
                aria-label={t("chatInput.agent.selectLabel")}
                disabled={isSwitchDisabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuContent((current) => (current === "models" ? "agents" : "models"));
                }}
              >
                <Repeat size={14} />
              </Button>
            </Tooltip>
          </HStack>
          <Menu.Separator margin="0" />
          <Box
            maxH="18rem"
            overflowY="auto"
            py="1"
            data-testid={isShowingAgents ? "workspace-agent-options" : "workspace-agent-model-options"}
          >
            {isShowingAgents ? (
              agentOptions.length > 0 ? (
                agentOptions.map((option) => (
                  <MenuItem
                    key={option.value}
                    id={option.value}
                    primaryLabel={option.label}
                    leftIcon={option.icon ?? TerminalIcon}
                    isSelected={option.value === selectedAgent}
                    isDisabled={option.disabled}
                    onClick={() => !option.disabled && onSelectAgent(option.value)}
                  />
                ))
              ) : (
                <MenuItem primaryLabel={t("chatInput.agent.unknown")} leftIcon={TerminalIcon} isDisabled />
              )
            ) : modelOptions.length > 0 ? (
              modelOptions.map((option) => (
                <MenuItem
                  key={option.value}
                  id={option.value}
                  primaryLabel={option.label}
                  isSelected={option.value === selectedModel}
                  onClick={() => onSelectModel(option.value)}
                />
              ))
            ) : (
              <MenuItem primaryLabel={t("chatInput.model.noneAvailable")} leftIcon={Cpu} isDisabled />
            )}
          </Box>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
