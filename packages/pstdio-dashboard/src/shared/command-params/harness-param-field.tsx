import { HStack } from "@chakra-ui/react";
import {
  filterHarnessParamValues,
  HarnessModelPicker,
  HarnessParamEditor,
  HarnessParamInlineControls,
  type HarnessParamValues,
  harnessParamValuesEqual,
  resolveHarnessParamDefaults,
} from "@pstdio/ui/param-editor";
import type { WorkbenchCore } from "@pstdio/workbench";
import { type CommandParamFieldProps, commandParamName } from "@pstdio/workbench/react";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import { useEffect } from "react";
import { resolveSynchronizedModel } from "@/shared/agents/agent-model-selection";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { useHarnessParamDefaults } from "@/shared/agents/use-harness-param-defaults";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { ExtensionIcon } from "@/shared/components/extension-icon";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { useProject } from "@/shared/projects/use-project";
import { changedHarnessParams } from "./harness-settings";
import { parseParamRecord, serializeParamRecord } from "./param-field-shared";
import {
  readRecentHarnessSelection,
  readRecentHarnessSetup,
  resolveInitialHarnessSelection,
  saveRecentHarnessSelection,
} from "./recent-harness-param";

interface HarnessParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const readHarness = (value: CommandParamFieldProps["value"]) => {
  const record = parseParamRecord(value);
  const params =
    record.params && typeof record.params === "object" && !Array.isArray(record.params) ? record.params : {};
  return {
    harnessId: typeof record.harnessId === "string" ? record.harnessId : "",
    model: typeof record.model === "string" ? record.model : "",
    params: Object.fromEntries(
      Object.entries(params).filter(([, entry]) => typeof entry === "string" || typeof entry === "boolean"),
    ) as HarnessParamValues,
  };
};

export const HarnessParamField = (props: HarnessParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const { lockIdentity, preserveSettings, settingsMode } = props.harness ?? {};
  const projectId = getDashboardSelectedProjectId(workbench);
  const { data: project } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const { harnessId, model, params } = readHarness(value);
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === harnessId);
  const selectedAgentInfo = agents.find((agent) => agent.id === harnessId);
  const harnessParamDefaults = useHarnessParamDefaults(
    projectId,
    isResolvedAgent ? harnessId : undefined,
    model || undefined,
  );
  const modelsQuery = useAgentModels(harnessId, {
    enabled: Boolean(harnessId) && isResolvedAgent,
    projectId,
  });
  const models = modelsQuery.data ?? [];

  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
    description: agent.availability.reason,
    icon: agent.icon ? () => <ExtensionIcon name={agent.icon} /> : undefined,
  }));
  const modelOptions = models.map((entry) => ({
    label: entry.label ?? entry.id,
    value: entry.id,
    description: entry.description,
  }));
  if (model && !modelOptions.some((option) => option.value === model)) {
    modelOptions.push({ label: model, value: model, description: undefined });
  }

  const defaultAgent = project?.default_agent_id;
  const baseParamSchema = harnessParamDefaults.data?.schema ?? selectedAgentInfo?.params;
  const selectedModelInfo = findAgentModel(models, model);
  const effectiveParamSchema = resolveAgentModelParams(baseParamSchema, selectedModelInfo);
  const effectiveParamDefaults = resolveHarnessParamDefaults(effectiveParamSchema, harnessParamDefaults.data?.defaults);
  const effectiveParams = filterHarnessParamValues(effectiveParamSchema, params);

  useEffect(() => {
    // Wait for the agent list so the first-available fallback resolves to a real harness
    // instead of committing an empty value before the options arrive.
    if (disabled || isAgentsLoading || lockIdentity || preserveSettings) return;
    const next = resolveInitialHarnessSelection({
      current: { harnessId, model },
      recent: readRecentHarnessSelection(projectId),
      defaultAgent,
      agents,
    });
    if (next.harnessId === harnessId && next.model === model) return;
    onChange(
      serializeParamRecord({
        harnessId: next.harnessId,
        ...(next.model ? { model: next.model } : {}),
        ...(next.params ? { params: next.params } : {}),
      }),
    );
  }, [
    agents,
    defaultAgent,
    disabled,
    harnessId,
    isAgentsLoading,
    model,
    onChange,
    projectId,
    lockIdentity,
    preserveSettings,
  ]);

  useEffect(() => {
    // Saved overrides must survive until both harness and model schemas are known.
    if (disabled || preserveSettings || !isResolvedAgent || !harnessParamDefaults.isSuccess || !modelsQuery.isSuccess)
      return;
    // A remembered model can be stale for the selected harness; swap it for an
    // offered one (or clear it) once the model list is known.
    const next = resolveSynchronizedModel({
      currentAgent: harnessId,
      currentModel: model,
      modelsQuery,
      modelHistory: [],
    });
    const synchronizedModel = next === undefined ? model : next;
    const synchronizedModelInfo = findAgentModel(models, synchronizedModel);
    const synchronizedSchema = resolveAgentModelParams(baseParamSchema, synchronizedModelInfo);
    const synchronizedParams = filterHarnessParamValues(synchronizedSchema, params);
    if ((next === undefined || next === model) && harnessParamValuesEqual(params, synchronizedParams)) return;
    onChange(
      serializeParamRecord({
        harnessId,
        ...(synchronizedModel ? { model: synchronizedModel } : {}),
        ...(Object.keys(synchronizedParams).length ? { params: synchronizedParams } : {}),
      }),
    );
  }, [
    baseParamSchema,
    preserveSettings,
    disabled,
    harnessId,
    harnessParamDefaults.isSuccess,
    isResolvedAgent,
    model,
    models,
    modelsQuery,
    onChange,
    params,
  ]);

  const handleSelectAgent = (agent: string) => {
    if (lockIdentity) return;
    const saved = preserveSettings ? undefined : readRecentHarnessSetup(projectId, agent);
    const next = {
      harnessId: agent,
      ...(saved?.model ? { model: saved.model } : {}),
      ...(saved?.params ? { params: saved.params } : {}),
    };
    if (!preserveSettings) saveRecentHarnessSelection(projectId, { harnessId: agent });
    onChange(serializeParamRecord(next));
  };
  const handleSelectModel = (selected: string) => {
    const selectedInfo = findAgentModel(models, selected);
    const selectedParams = filterHarnessParamValues(resolveAgentModelParams(baseParamSchema, selectedInfo), params);
    const next = {
      harnessId,
      ...(selected ? { model: selected } : {}),
      ...(Object.keys(selectedParams).length ? { params: selectedParams } : {}),
    };
    if (!preserveSettings)
      saveRecentHarnessSelection(projectId, { harnessId, model: selected, params: selectedParams });
    onChange(serializeParamRecord(next));
  };
  const handleParamsChange = (overrides: HarnessParamValues) => {
    const nextParams = changedHarnessParams(overrides, effectiveParamDefaults, settingsMode);
    if (!preserveSettings) saveRecentHarnessSelection(projectId, { harnessId, model, params: nextParams });
    onChange(
      serializeParamRecord({
        harnessId,
        ...(model ? { model } : {}),
        ...(Object.keys(nextParams).length ? { params: nextParams } : {}),
      }),
    );
  };

  if (props.harness?.presentation === "chat")
    return (
      <HStack gap="2xs" minW="0">
        <WorkspaceAgentMenu
          agentOptions={agentOptions}
          selectedAgent={isResolvedAgent ? harnessId : ""}
          onSelectAgent={handleSelectAgent}
          modelOptions={modelOptions}
          selectedModel={model}
          onSelectModel={handleSelectModel}
          offersModels={selectedAgentInfo?.supportsModels}
          isDisabled={disabled}
          isAgentSwitchDisabled={lockIdentity}
          isAgentsLoading={isAgentsLoading}
          isModelsLoading={modelsQuery.isLoading}
          size="xs"
        />
        <HarnessParamInlineControls
          schema={effectiveParamSchema ?? undefined}
          defaults={effectiveParamDefaults}
          overrides={effectiveParams}
          onOverridesChange={handleParamsChange}
          disabled={disabled || !isResolvedAgent}
          size="xs"
        />
      </HStack>
    );

  return (
    <>
      <HarnessModelPicker
        label={commandParamName(entry)}
        description={entry.description}
        harnesses={agentOptions.map((option) => ({ id: option.value, name: option.label, disabled: option.disabled }))}
        models={modelOptions.map((option) => ({
          id: option.value,
          name: option.label,
          description: option.description,
        }))}
        harnessId={isResolvedAgent ? harnessId : ""}
        model={model}
        disabled={disabled}
        lockHarness={lockIdentity}
        loadingHarnesses={isAgentsLoading}
        loadingModels={modelsQuery.isLoading}
        onHarnessChange={handleSelectAgent}
        onModelChange={handleSelectModel}
      />
      <HarnessParamEditor
        showCommandParams={false}
        schema={effectiveParamSchema ?? undefined}
        defaults={effectiveParamDefaults}
        overrides={effectiveParams}
        onOverridesChange={handleParamsChange}
        disabled={disabled || !isResolvedAgent}
      />
    </>
  );
};
