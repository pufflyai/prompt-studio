import { Badge, Button, Flex, HStack, Icon, Menu, Spinner, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChevronDown, TerminalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import type { AgentInfo } from "@/features/agents/types";

interface ProjectAgentsPanelViewProps {
  enabledAgentIds: string[];
  agents: AgentInfo[];
  defaultAgentId: string | null;
  defaultAgentModel: string | null;
  isUpdating: boolean;
  onSetDefaultAgent: (agentId: string) => void;
  onSetDefaultModel: (modelId: string | null) => void;
}

interface AgentRowProps {
  agent: AgentInfo;
  isProjectDefault: boolean;
  isUpdating: boolean;
  defaultModel: string | null;
  onSelectAsDefault: () => void;
  onSelectModel: (modelId: string | null) => void;
}

const AgentRow = (props: AgentRowProps) => {
  const { agent, isProjectDefault, isUpdating, defaultModel, onSelectAsDefault, onSelectModel } = props;
  const { t } = useTranslation("projects");

  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(agent.id, { enabled: isProjectDefault });

  const selectedModelLabel = defaultModel ?? t("projectSettings.agentsPanel.agentDefault");

  return (
    <Stack
      gap="sm"
      px="md"
      py="sm"
      borderWidth="1px"
      borderColor={isProjectDefault ? "border.emphasized" : "border.muted"}
      borderRadius="md"
    >
      <Flex alignItems="center" justifyContent="space-between" gap="md">
        <HStack gap="sm">
          <Icon as={TerminalIcon} boxSize="16px" color="fg.muted" />
          <Text textStyle="label/S/medium">{agent.name}</Text>
          {isProjectDefault && <Badge colorPalette="blue">{t("projectSettings.agentsPanel.defaultBadge")}</Badge>}
        </HStack>

        {!isProjectDefault && (
          <Button size="xs" variant="outline" onClick={onSelectAsDefault} disabled={isUpdating}>
            {t("projectSettings.agentsPanel.setAsDefault")}
          </Button>
        )}
      </Flex>

      {isProjectDefault && (
        <HStack justify="space-between" alignItems="center">
          <Stack gap="0">
            <Text textStyle="label/XS/medium">{t("projectSettings.agentsPanel.defaultModel")}</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {t("projectSettings.agentsPanel.modelDescription")}
            </Text>
          </Stack>

          {isModelsLoading ? (
            <Spinner size="xs" />
          ) : (
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  width="auto"
                  minW="220px"
                  justifyContent="space-between"
                  disabled={isUpdating}
                >
                  {selectedModelLabel}
                  <Icon as={ChevronDown} color="fg.muted" />
                </Button>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="220px" bg="bg">
                  <Menu.Item value="default" asChild>
                    <ListRow
                      asChild
                      variant="compact"
                      id="default"
                      label={t("projectSettings.agentsPanel.agentDefault")}
                      isSelected={!defaultModel}
                      onActivate={() => onSelectModel(null)}
                    />
                  </Menu.Item>
                  {models.map((m) => (
                    <Menu.Item key={m.id} value={m.id} asChild>
                      <ListRow
                        asChild
                        variant="compact"
                        id={m.id}
                        label={m.id}
                        isSelected={defaultModel === m.id}
                        onActivate={() => onSelectModel(m.id)}
                      />
                    </Menu.Item>
                  ))}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          )}
        </HStack>
      )}
    </Stack>
  );
};

export const ProjectAgentsPanelView = (props: ProjectAgentsPanelViewProps) => {
  const {
    enabledAgentIds,
    agents,
    defaultAgentId,
    defaultAgentModel,
    isUpdating,
    onSetDefaultAgent,
    onSetDefaultModel,
  } = props;
  const { t } = useTranslation("projects");

  const installedAgents = agents.filter((a) => a.availability.type === "INSTALLED");
  const enabledAgents =
    enabledAgentIds.length > 0 ? installedAgents.filter((a) => enabledAgentIds.includes(a.id)) : installedAgents;

  if (enabledAgents.length === 0) {
    return (
      <Stack padding="lg" gap="lg">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("projectSettings.agentsPanel.empty")}
        </Text>
      </Stack>
    );
  }

  const defaultIsAvailable = defaultAgentId ? enabledAgents.some((a) => a.id === defaultAgentId) : true;

  return (
    <Stack padding="lg" gap="md">
      {!defaultIsAvailable && defaultAgentId && (
        <Text textStyle="paragraph/XS/regular" color="fg.error">
          {t("projectSettings.agentsPanel.missingDefaultWarning")}
        </Text>
      )}

      {enabledAgents.map((agent) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          isProjectDefault={defaultAgentId === agent.id}
          isUpdating={isUpdating}
          defaultModel={defaultAgentId === agent.id ? defaultAgentModel : null}
          onSelectAsDefault={() => onSetDefaultAgent(agent.id)}
          onSelectModel={onSetDefaultModel}
        />
      ))}
    </Stack>
  );
};
