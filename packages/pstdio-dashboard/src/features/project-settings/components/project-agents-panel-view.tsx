import { HStack, Stack, Text } from "@chakra-ui/react";
import { TerminalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkspaceAgentMenu, type WorkspacePanelMenuOption } from "@/features/agents/components/agent-browser";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import type { AgentInfo } from "@/features/agents/types";

const AGENT_DEFAULT_MODEL_ID = "__agent-default";

interface ProjectAgentsPanelViewProps {
  enabledAgentIds: string[];
  agents: AgentInfo[];
  defaultAgentId: string | null;
  defaultAgentModel: string | null;
  isUpdating: boolean;
  onSetDefaultAgent: (agentId: string, modelId: string | null) => void;
}

interface DefaultModelSelectorProps {
  agentOptions: WorkspacePanelMenuOption[];
  selectedAgent: string;
  selectedModel: string | null;
  selectedAgentIsDefault: boolean;
  isUpdating: boolean;
  onSelectAgent: (agentId: string, modelId: string | null) => void;
}

const buildModelOptions = (models: { id: string }[], agentDefaultLabel: string) => [
  { label: agentDefaultLabel, value: AGENT_DEFAULT_MODEL_ID },
  ...models.map((model) => ({ label: model.id, value: model.id })),
];

const DefaultModelSelector = (props: DefaultModelSelectorProps) => {
  const { agentOptions, selectedAgent, selectedModel, selectedAgentIsDefault, isUpdating, onSelectAgent } = props;
  const { t } = useTranslation("projects");

  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent),
  });
  const modelOptions = buildModelOptions(models, t("projectSettings.agentsPanel.agentDefault"));

  return (
    <HStack justify="space-between" alignItems="center">
      <Stack gap="0">
        <Text textStyle="label/XS/medium">{t("projectSettings.agentsPanel.defaultModel")}</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {t("projectSettings.agentsPanel.modelDescription")}
        </Text>
      </Stack>

      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={selectedAgent}
        onSelectAgent={(agentId) => {
          if (selectedAgentIsDefault && agentId === selectedAgent) return;
          onSelectAgent(agentId, null);
        }}
        modelOptions={modelOptions}
        selectedModel={selectedModel ?? AGENT_DEFAULT_MODEL_ID}
        onSelectModel={(modelId) => onSelectAgent(selectedAgent, modelId === AGENT_DEFAULT_MODEL_ID ? null : modelId)}
        isDisabled={isUpdating || !selectedAgent}
        isModelsLoading={isModelsLoading}
      />
    </HStack>
  );
};

export const ProjectAgentsPanelView = (props: ProjectAgentsPanelViewProps) => {
  const { enabledAgentIds, agents, defaultAgentId, defaultAgentModel, isUpdating, onSetDefaultAgent } = props;
  const { t } = useTranslation("projects");

  const installedAgents = agents.filter((a) => a.availability.type === "INSTALLED");
  const enabledAgents =
    enabledAgentIds.length > 0 ? installedAgents.filter((a) => enabledAgentIds.includes(a.id)) : installedAgents;
  const agentOptions = enabledAgents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    icon: TerminalIcon,
  }));

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
  const selectedAgent = defaultIsAvailable && defaultAgentId ? defaultAgentId : (enabledAgents[0]?.id ?? "");

  return (
    <Stack padding="lg" gap="md">
      {!defaultIsAvailable && defaultAgentId && (
        <Text textStyle="paragraph/XS/regular" color="fg.error">
          {t("projectSettings.agentsPanel.missingDefaultWarning")}
        </Text>
      )}

      <DefaultModelSelector
        agentOptions={agentOptions}
        selectedAgent={selectedAgent}
        selectedModel={defaultAgentId === selectedAgent ? defaultAgentModel : null}
        selectedAgentIsDefault={defaultAgentId === selectedAgent}
        isUpdating={isUpdating}
        onSelectAgent={onSetDefaultAgent}
      />
    </Stack>
  );
};
