import { Stack } from "@chakra-ui/react";
import { ParamEditor, type SelectionOption, type SelectionParam } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import type { CommandParamFieldProps } from "@pstdio/workbench/react";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import { useEffect } from "react";
import { HarnessParamEditor } from "@/modules/sessions/components/harness-param-editor";
import {
  filterHarnessParamValues,
  type HarnessParamValues,
  harnessParamValuesEqual,
} from "@/modules/sessions/components/harness-param-values";
import { useHarnessParamDefaults } from "@/modules/sessions/hooks/use-harness-param-defaults";
import { resolveSynchronizedModel } from "@/shared/agents/agent-model-selection";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { useProject } from "@/shared/projects/use-project";
import { parseParamRecord, serializeParamRecord } from "./param-field-shared";
import {
  readRecentHarnessSelection,
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
  const projectId = getDashboardSelectedProjectId(workbench);
  const { data: project } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const { harnessId, model, params } = readHarness(value);
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === harnessId);
  const selectedAgentInfo = agents.find((agent) => agent.id === harnessId);
  const harnessParamDefaults = useHarnessParamDefaults(projectId, isResolvedAgent ? harnessId : undefined);
  const modelsQuery = useAgentModels(harnessId, {
    enabled: Boolean(harnessId) && isResolvedAgent,
    projectId,
  });
  const models = modelsQuery.data ?? [];

  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
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
  const effectiveParamDefaults = filterHarnessParamValues(effectiveParamSchema, harnessParamDefaults.data?.defaults);
  const effectiveParams = filterHarnessParamValues(effectiveParamSchema, params);

  useEffect(() => {
    // Wait for the agent list so the first-available fallback resolves to a real harness
    // instead of committing an empty value before the options arrive.
    if (isAgentsLoading) return;
    const next = resolveInitialHarnessSelection({
      current: { harnessId, model },
      recent: readRecentHarnessSelection(projectId),
      defaultAgent,
      agents,
    });
    if (next.harnessId === harnessId && next.model === model) return;
    onChange(serializeParamRecord({ harnessId: next.harnessId, ...(next.model ? { model: next.model } : {}) }));
  }, [agents, defaultAgent, harnessId, isAgentsLoading, model, onChange, projectId]);

  useEffect(() => {
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
  }, [baseParamSchema, harnessId, model, models, modelsQuery, onChange, params]);

  const handleSelectAgent = (agent: string) => {
    const next = { harnessId: agent };
    saveRecentHarnessSelection(projectId, next);
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
    saveRecentHarnessSelection(projectId, next);
    onChange(serializeParamRecord(next));
  };
  const handleParamsChange = (nextParams: HarnessParamValues) => {
    onChange(
      serializeParamRecord({
        harnessId,
        ...(model ? { model } : {}),
        ...(Object.keys(nextParams).length ? { params: nextParams } : {}),
      }),
    );
  };

  const modelSelectionOptions: SelectionOption[] = modelOptions.map((option) => ({
    id: option.value,
    name: option.label,
    description: option.description,
    icon: "Cpu",
  }));
  if (modelsQuery.isLoading && modelSelectionOptions.length === 0) {
    modelSelectionOptions.push({ id: "model-loading", name: "Loading models…", icon: "Cpu", disabled: true });
  }
  const modelParam: SelectionParam = {
    id: "model",
    name: `${entry.label}${entry.required ? " *" : ""}`,
    description: entry.description,
    type: "selection",
    defaultValue: model,
    options: modelSelectionOptions,
    placeholder: "Select model",
    searchable: modelOptions.length > 5,
    searchPlaceholder: "Search models…",
    emptyText: "No models available",
    disabled: disabled || (agents.length === 0 && !isAgentsLoading),
    group: {
      id: "harnessId",
      name: "Harness",
      defaultValue: isResolvedAgent ? harnessId : "",
      options: agentOptions.map((option) => ({
        id: option.value,
        name: option.label,
        icon: "Terminal",
        disabled: option.disabled,
      })),
      placeholder: isAgentsLoading ? "Loading harnesses…" : "Select harness",
      searchable: agentOptions.length > 10,
      searchPlaceholder: "Search harnesses…",
      emptyText: "No harnesses available",
      disabled: disabled || isAgentsLoading || agentOptions.length <= 1,
    },
  };

  return (
    <Stack gap="0">
      <ParamEditor
        params={[modelParam]}
        defaultValues={{ model, harnessId: isResolvedAgent ? harnessId : "" }}
        onChange={(id, nextValue) => {
          if (typeof nextValue !== "string") return;
          if (id === "harnessId") handleSelectAgent(nextValue);
          if (id === "model") handleSelectModel(nextValue);
        }}
      />
      <HarnessParamEditor
        schema={effectiveParamSchema ?? undefined}
        defaults={effectiveParamDefaults}
        overrides={effectiveParams}
        onOverridesChange={handleParamsChange}
        disabled={disabled || !isResolvedAgent}
      />
    </Stack>
  );
};
