import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { TerminalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceAgentMenu, type WorkspacePanelMenuOption } from "@/features/agents/components/agent-browser";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import type { AgentInfo } from "@/features/agents/types";

interface ProjectAgentsPanelViewProps {
  enabledAgentIds: string[];
  agents: AgentInfo[];
  defaultAgentId: string | null;
  defaultAgentModel: string | null;
  isUpdating: boolean;
  updateFailureCount: number;
  onSetDefaultAgent: (agentId: string, modelId: string | null) => void;
}

interface DefaultModelSelectorProps {
  agentOptions: WorkspacePanelMenuOption[];
  selectedAgent: string;
  selectedModel: string | null;
  isUpdating: boolean;
  updateFailureCount: number;
  onSelectAgent: (agentId: string, modelId: string | null) => void;
}

const buildModelOptions = (models: { id: string }[]) => models.map((model) => ({ label: model.id, value: model.id }));

const DefaultModelSelector = (props: DefaultModelSelectorProps) => {
  const { agentOptions, selectedAgent, selectedModel, isUpdating, updateFailureCount, onSelectAgent } = props;
  const { t } = useTranslation("projects");
  const [draftAgent, setDraftAgent] = useState(selectedAgent);
  const [draftModel, setDraftModel] = useState(selectedModel);

  useEffect(() => {
    setDraftAgent(selectedAgent);
    setDraftModel(selectedModel);
  }, [selectedAgent, selectedModel]);

  useEffect(() => {
    if (updateFailureCount === 0) return;

    setDraftAgent(selectedAgent);
    setDraftModel(selectedModel);
  }, [updateFailureCount, selectedAgent, selectedModel]);

  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(draftAgent, {
    enabled: Boolean(draftAgent),
  });
  const modelOptions = buildModelOptions(models);

  const handleSelectAgent = (agentId: string) => {
    if (agentId === draftAgent) return;

    setDraftAgent(agentId);
    setDraftModel(null);
    onSelectAgent(agentId, null);
  };

  const handleSelectModel = (modelId: string) => {
    setDraftModel(modelId);
    onSelectAgent(draftAgent, modelId);
  };

  const handleClearModel = () => {
    setDraftModel(null);
    onSelectAgent(draftAgent, null);
  };

  return (
    <HStack justify="space-between" alignItems="center">
      <Stack gap="0">
        <Text textStyle="label/XS/medium">{t("projectSettings.agentsPanel.defaultModel")}</Text>
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {t("projectSettings.agentsPanel.modelDescription")}
        </Text>
      </Stack>

      <HStack gap="xs">
        {draftModel ? (
          <Button size="xs" variant="ghost" disabled={isUpdating} onClick={handleClearModel}>
            {t("projectSettings.agentsPanel.clearModel")}
          </Button>
        ) : null}
        <WorkspaceAgentMenu
          agentOptions={agentOptions}
          selectedAgent={draftAgent}
          onSelectAgent={handleSelectAgent}
          modelOptions={modelOptions}
          selectedModel={draftModel ?? ""}
          selectedModelLabel={draftModel ? undefined : t("projectSettings.agentsPanel.agentDefault")}
          onSelectModel={handleSelectModel}
          isDisabled={isUpdating || !draftAgent}
          isModelsLoading={isModelsLoading}
        />
      </HStack>
    </HStack>
  );
};

export const ProjectAgentsPanelView = (props: ProjectAgentsPanelViewProps) => {
  const {
    enabledAgentIds,
    agents,
    defaultAgentId,
    defaultAgentModel,
    isUpdating,
    updateFailureCount,
    onSetDefaultAgent,
  } = props;
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
        isUpdating={isUpdating}
        updateFailureCount={updateFailureCount}
        onSelectAgent={onSetDefaultAgent}
      />
    </Stack>
  );
};
