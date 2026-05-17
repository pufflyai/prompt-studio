import { Box, Button, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { WorkspaceAgentMenu } from "@/features/agents/components/agent-browser";
import { useAgentConfigs, useDisableAgent, useEnableAgent } from "@/features/agents/hooks/use-agent-configs";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { useProjectDefaults, useUpdateProjectDefaults } from "../hooks/use-project-defaults";
import { type HarnessRow, readBinaryPath, resolveDefaultHarnessId, toHarnessRows } from "../utils/harness-settings";
import { AddAgentManuallyDialog, SUPPORTED_AGENT_IDS, type SupportedAgentId } from "./add-agent-manually-dialog";
import { HarnessCard } from "./harness-card";
import { HarnessDefaultModelCard } from "./harness-default-model-card";

interface HarnessesPanelProps {
  projectId: string | undefined;
}

interface HarnessCardRowProps {
  row: HarnessRow;
  isMutating: boolean;
  onToggleEnabled: (row: HarnessRow) => void;
  onAddManually: () => void;
}

const HarnessCardRow = (props: HarnessCardRowProps) => {
  const { row, isMutating, onToggleEnabled, onAddManually } = props;
  const isEnabled = !!row.config;

  return (
    <HarnessCard
      agentId={row.id}
      name={row.name}
      isInstalled={row.isInstalled}
      isEnabled={isEnabled}
      binaryPath={row.config ? readBinaryPath(row.config.config) : undefined}
      isMutating={isMutating}
      onToggleEnabled={() => onToggleEnabled(row)}
      onAddManually={onAddManually}
    />
  );
};

export const HarnessesPanel = (props: HarnessesPanelProps) => {
  const { projectId } = props;
  const { t } = useTranslation("settings");
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
  const { data: configs = [], isLoading: isConfigsLoading } = useAgentConfigs();
  const { data: project, isLoading: isProjectLoading } = useProjectDefaults(projectId);
  const updateProjectDefaults = useUpdateProjectDefaults(projectId);
  const enableAgent = useEnableAgent();
  const disableAgent = useDisableAgent();
  const [isManualAddOpen, setManualAddOpen] = useState(false);

  const isLoading = isAgentsLoading || isConfigsLoading || (projectId && isProjectLoading);
  const isMutating = enableAgent.isPending || disableAgent.isPending || updateProjectDefaults.isPending;
  const rows = toHarnessRows(agents, configs);
  const selectedDefaultHarnessId = resolveDefaultHarnessId(project?.default_agent_id ?? null, rows);
  const { data: defaultModels = [], isLoading: isDefaultModelsLoading } = useAgentModels(selectedDefaultHarnessId, {
    enabled: Boolean(projectId && selectedDefaultHarnessId),
  });
  const defaultHarnessOptions = rows
    .filter((row) => row.config)
    .map((row) => ({
      label: row.name,
      value: row.id,
      disabled: !row.isInstalled,
    }));
  const selectedDefaultModelId = project?.default_agent_model ?? "";
  const defaultModelOptions = defaultModels.map((model) => ({ label: model.id, value: model.id }));
  if (selectedDefaultModelId && !defaultModelOptions.some((option) => option.value === selectedDefaultModelId)) {
    defaultModelOptions.push({ label: selectedDefaultModelId, value: selectedDefaultModelId });
  }
  const existingAgentIds = configs.map((config) => config.agent_id);
  const allAgentsConnected = SUPPORTED_AGENT_IDS.every((id) => existingAgentIds.includes(id));

  const handleToggle = (row: HarnessRow) => {
    if (row.config) {
      disableAgent.mutate(row.id, {
        onError: (error) => {
          toaster.create({ type: "error", title: t("agentList.failedToDisableAgent"), description: error.message });
        },
      });
      return;
    }

    enableAgent.mutate(
      { agentId: row.id },
      {
        onError: (error) => {
          toaster.create({ type: "error", title: t("agentList.failedToEnableAgent"), description: error.message });
        },
      },
    );
  };

  const handleSelectDefaultHarness = (agentId: string) => {
    if (!projectId) return;
    updateProjectDefaults.mutate(
      { default_agent_id: agentId, default_agent_model: null },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("agentList.failedToSetDefaultAgent"),
            description: error.message,
          });
        },
      },
    );
  };

  const handleSelectDefaultModel = (modelId: string) => {
    if (!projectId || !selectedDefaultHarnessId) return;
    updateProjectDefaults.mutate(
      { default_agent_id: selectedDefaultHarnessId, default_agent_model: modelId },
      {
        onError: (error) => {
          toaster.create({
            type: "error",
            title: t("agentList.failedToSetDefaultModel"),
            description: error.message,
          });
        },
      },
    );
  };

  const handleManualAdd = async (agentId: SupportedAgentId, binary: string) => {
    try {
      await enableAgent.mutateAsync({ agentId, binary });
      setManualAddOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("agentList.failedToEnableAgent");
      toaster.create({ type: "error", title: t("agentList.failedToEnableAgent"), description: message });
    }
  };

  return (
    <>
      <Stack gap="md" padding="lg">
        <HStack justify="space-between" alignItems="center">
          <Stack gap="2xs">
            <Text textStyle="heading/S">{t("harnessesPanel.title")}</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {projectId ? t("harnessesPanel.descriptionProject") : t("harnessesPanel.descriptionGlobal")}
            </Text>
          </Stack>
          {!allAgentsConnected ? (
            <Button size="xs" variant="subtle" onClick={() => setManualAddOpen(true)}>
              <Plus size={14} />
              {t("agentList.addAgentManually")}
            </Button>
          ) : null}
        </HStack>

        {isLoading ? (
          <Box py="md" display="flex" justifyContent="center">
            <Spinner size="sm" />
          </Box>
        ) : rows.length === 0 ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("agentList.noAgentsFound")}
          </Text>
        ) : (
          <Stack gap="lg">
            {projectId ? (
              <Stack gap="sm">
                <HarnessDefaultModelCard>
                  <WorkspaceAgentMenu
                    agentOptions={defaultHarnessOptions}
                    selectedAgent={selectedDefaultHarnessId}
                    onSelectAgent={handleSelectDefaultHarness}
                    modelOptions={defaultModelOptions}
                    selectedModel={selectedDefaultModelId}
                    onSelectModel={handleSelectDefaultModel}
                    isDisabled={isMutating}
                    isModelsLoading={isDefaultModelsLoading}
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
                </HarnessDefaultModelCard>
              </Stack>
            ) : null}
            <Stack gap="sm">
              {rows.map((row) => (
                <HarnessCardRow
                  key={row.id}
                  row={row}
                  isMutating={isMutating}
                  onToggleEnabled={handleToggle}
                  onAddManually={() => setManualAddOpen(true)}
                />
              ))}
            </Stack>
          </Stack>
        )}
      </Stack>

      <AddAgentManuallyDialog
        open={isManualAddOpen}
        isSubmitting={enableAgent.isPending}
        existingAgentIds={existingAgentIds}
        onClose={() => setManualAddOpen(false)}
        onCreate={handleManualAdd}
      />
    </>
  );
};
