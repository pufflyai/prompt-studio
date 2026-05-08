import { Flex, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { WorkspaceAgentMenu } from "@/features/agents/components/agent-browser";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import type { AgentInfo } from "@/features/agents/types";

const HARNESS_DEFAULT_MODEL = "__harness-default";

interface ProjectAgentsPanelViewProps {
  enabledAgentIds: string[];
  agents: AgentInfo[];
  defaultAgentId: string | null;
  defaultAgentModel: string | null;
  isUpdating: boolean;
  onSetDefaultAgent: (agentId: string) => void;
  onSetDefaultModel: (modelId: string | null) => void;
}

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
  const defaultIsAvailable = defaultAgentId ? enabledAgents.some((a) => a.id === defaultAgentId) : true;
  const selectedAgentId = defaultIsAvailable ? (defaultAgentId ?? "") : "";
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgentId, {
    enabled: Boolean(selectedAgentId),
  });
  const missingDefaultWarning =
    !defaultIsAvailable && defaultAgentId ? (
      <Text textStyle="paragraph/XS/regular" color="fg.error">
        {t("projectSettings.agentsPanel.missingDefaultWarning")}
      </Text>
    ) : null;

  if (enabledAgents.length === 0) {
    return (
      <Stack padding="lg" gap="lg">
        {missingDefaultWarning}
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("projectSettings.agentsPanel.empty")}
        </Text>
      </Stack>
    );
  }

  const modelOptions = [
    { label: t("projectSettings.agentsPanel.harnessDefault"), value: HARNESS_DEFAULT_MODEL },
    ...models.map((model) => ({ label: model.id, value: model.id })),
  ];

  if (defaultAgentModel && !modelOptions.some((option) => option.value === defaultAgentModel)) {
    modelOptions.push({ label: defaultAgentModel, value: defaultAgentModel });
  }

  return (
    <Stack padding="lg" gap="md" maxW="640px">
      {missingDefaultWarning}

      <Flex direction={{ base: "column", md: "row" }} justify="space-between" alignItems="flex-start" gap="md">
        <Stack gap="0">
          <Text textStyle="label/S/medium">{t("projectSettings.agentsPanel.defaultHarness")}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {t("projectSettings.agentsPanel.modelDescription")}
          </Text>
        </Stack>

        <WorkspaceAgentMenu
          agentOptions={enabledAgents.map((agent) => ({ label: agent.name, value: agent.id }))}
          selectedAgent={selectedAgentId}
          onSelectAgent={(agentId) => {
            if (agentId === defaultAgentId) return;
            onSetDefaultAgent(agentId);
          }}
          modelOptions={modelOptions}
          selectedModel={defaultAgentModel ?? HARNESS_DEFAULT_MODEL}
          onSelectModel={(modelId) => onSetDefaultModel(modelId === HARNESS_DEFAULT_MODEL ? null : modelId)}
          isDisabled={isUpdating}
          shouldDisableSingleAgentSwitch={Boolean(selectedAgentId)}
          isModelsLoading={isModelsLoading}
          labels={{
            agentSelect: t("projectSettings.agentsPanel.selectHarness"),
            agentUnknown: t("projectSettings.agentsPanel.unknownHarness"),
            agentLoading: t("projectSettings.agentsPanel.loadingHarnesses"),
            modelSelect: t("projectSettings.agentsPanel.selectModel"),
            modelNone: t("projectSettings.agentsPanel.harnessDefault"),
            modelNoneAvailable: t("projectSettings.agentsPanel.noModelsAvailable"),
            modelLoading: t("projectSettings.agentsPanel.loadingModels"),
            modelSearchPlaceholder: t("projectSettings.agentsPanel.searchModels"),
          }}
        />
      </Flex>
    </Stack>
  );
};
