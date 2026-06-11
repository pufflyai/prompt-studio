import { Stack } from "@chakra-ui/react";
import type { WorkbenchCore } from "pstdio-workbench/core";
import type { CommandParamFieldProps } from "pstdio-workbench/react";
import { useEffect } from "react";
import { resolveSynchronizedModel } from "@/shared/agents/agent-model-selection";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { useProject } from "@/shared/projects/use-project";
import { ParamFieldLabel, parseParamRecord, serializeParamRecord } from "./param-field-shared";
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
  return {
    harnessId: typeof record.harnessId === "string" ? record.harnessId : "",
    model: typeof record.model === "string" ? record.model : "",
  };
};

export const HarnessParamField = (props: HarnessParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const projectId = getDashboardSelectedProjectId(workbench);
  const { data: project } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const { harnessId, model } = readHarness(value);
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === harnessId);
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
  const modelOptions = models.map((entry) => ({ label: entry.id, value: entry.id }));
  if (model && !modelOptions.some((option) => option.value === model)) {
    modelOptions.push({ label: model, value: model });
  }

  const defaultAgent = project?.default_agent_id;

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
    if (next === undefined || next === model) return;
    onChange(serializeParamRecord({ harnessId, ...(next ? { model: next } : {}) }));
  }, [harnessId, model, modelsQuery, onChange]);

  const handleSelectAgent = (agent: string) => {
    const next = { harnessId: agent };
    saveRecentHarnessSelection(projectId, next);
    onChange(serializeParamRecord(next));
  };
  const handleSelectModel = (selected: string) => {
    const next = { harnessId, ...(selected ? { model: selected } : {}) };
    saveRecentHarnessSelection(projectId, next);
    onChange(serializeParamRecord(next));
  };

  return (
    <Stack gap="2xs">
      <ParamFieldLabel entry={entry} />
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={isResolvedAgent ? harnessId : ""}
        onSelectAgent={handleSelectAgent}
        modelOptions={isResolvedAgent ? modelOptions : []}
        selectedModel={isResolvedAgent ? model : ""}
        onSelectModel={handleSelectModel}
        isDisabled={disabled}
        isAgentsLoading={isAgentsLoading}
        isModelsLoading={modelsQuery.isLoading}
      />
    </Stack>
  );
};
