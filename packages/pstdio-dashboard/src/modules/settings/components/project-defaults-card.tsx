import { Box, Card, HStack, Icon, Stack } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { Bot } from "lucide-react";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import { useTranslation } from "react-i18next";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { HarnessParamEditor } from "../../sessions/components/harness-param-editor";
import { filterHarnessParamValues, type HarnessParamValues } from "../../sessions/components/harness-param-values";
import {
  useHarnessParamDefaults,
  useUpdateHarnessParamDefaults,
} from "../../sessions/hooks/use-harness-param-defaults";
import { useProjectDefaults, useUpdateProjectDefaults } from "../data/use-project-defaults";

interface ProjectDefaultsCardProps {
  projectId: string;
}

// The project's default harness and model, followed by the run options every session
// of that harness starts from. The options follow the selected model because a model
// can replace or drop harness params.
export const ProjectDefaultsCard = (props: ProjectDefaultsCardProps) => {
  const { projectId } = props;
  const { t } = useTranslation("settings");

  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const { data: project } = useProjectDefaults(projectId);
  const updateProjectDefaults = useUpdateProjectDefaults(projectId);

  const harnessOptions = agents.map((agent) => ({ label: agent.name, value: agent.id }));
  const storedDefault = project?.default_agent_id ?? "";
  const selectedHarnessId = harnessOptions.some((option) => option.value === storedDefault) ? storedDefault : "";
  const selectedHarness = agents.find((agent) => agent.id === selectedHarnessId);

  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedHarnessId, {
    enabled: Boolean(selectedHarnessId),
    projectId,
  });
  const storedModelId = project?.default_agent_model ?? "";
  const selectedModelId = models.some((model) => model.id === storedModelId)
    ? storedModelId
    : (findAgentModel(models, undefined)?.id ?? "");
  const modelOptions = models.map((model) => ({
    label: model.label ?? model.id,
    value: model.id,
    description: model.description,
  }));

  const paramDefaults = useHarnessParamDefaults(projectId, selectedHarnessId || undefined);
  const updateParamDefaults = useUpdateHarnessParamDefaults(projectId, selectedHarnessId || undefined);
  const paramSchema =
    resolveAgentModelParams(
      paramDefaults.data?.schema ?? selectedHarness?.params,
      findAgentModel(models, selectedModelId),
    ) ?? undefined;
  const storedParamDefaults = paramDefaults.data?.defaults ?? {};
  const paramValues = filterHarnessParamValues(paramSchema, storedParamDefaults);

  const handleSelectHarness = (agentId: string) => {
    updateProjectDefaults.mutate(
      { default_agent_id: agentId, default_agent_model: null },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("agentRow.failedToSetDefaultHarness"),
            description: error.message,
          });
        },
      },
    );
  };

  const handleSelectModel = (modelId: string) => {
    if (!selectedHarnessId) return;
    updateProjectDefaults.mutate(
      { default_agent_id: selectedHarnessId, default_agent_model: modelId || null },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("agentRow.failedToSetDefaultModel"),
            description: error.message,
          });
        },
      },
    );
  };

  const handleParamsChange = (next: HarnessParamValues) => {
    // Params the selected model hides keep their stored value for the other models.
    updateParamDefaults.mutate(
      { ...storedParamDefaults, ...next },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("harnessesPanel.runDefaultsSaveError"),
            description: error.message,
          });
        },
      },
    );
  };

  return (
    <Card.Root size="sm" borderRadius="0" data-testid="project-defaults-card">
      <Card.Body>
        <Stack gap="sm">
          <HStack gap="4" alignItems="flex-start">
            <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
              <Bot />
            </Icon>
            <Box flex="1" minW="0">
              <Stack gap="1">
                <Card.Title textStyle="sm">{t("harnessesPanel.defaultModelTitle")}</Card.Title>
                <Card.Description>{t("harnessesPanel.defaultModelDescription")}</Card.Description>
              </Stack>
            </Box>
            <HStack gap="2" flexShrink="0" alignItems="center">
              <WorkspaceAgentMenu
                agentOptions={harnessOptions}
                selectedAgent={selectedHarnessId}
                onSelectAgent={handleSelectHarness}
                modelOptions={modelOptions}
                selectedModel={selectedModelId}
                onSelectModel={handleSelectModel}
                isDisabled={updateProjectDefaults.isPending}
                isAgentsLoading={isAgentsLoading}
                isModelsLoading={isModelsLoading}
                labels={{
                  agentSelect: t("agentRow.defaultHarnessSelect"),
                  agentUnknown: t("agentRow.defaultHarnessNone"),
                  agentLoading: t("agentRow.harnessLoading"),
                  modelSelect: t("agentRow.defaultModelSelect"),
                  modelNone: t("agentRow.defaultModelNone"),
                  modelNoneAvailable: t("agentRow.modelNoneAvailable"),
                  modelLoading: t("agentRow.modelLoading"),
                  modelSearchPlaceholder: t("agentRow.modelSearch"),
                }}
              />
            </HStack>
          </HStack>
          <Box opacity={paramDefaults.isLoading ? 0.5 : 1} data-testid="project-run-defaults">
            <HarnessParamEditor
              schema={paramSchema}
              overrides={paramValues}
              onOverridesChange={handleParamsChange}
              disabled={paramDefaults.isLoading || updateParamDefaults.isPending}
            />
          </Box>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
