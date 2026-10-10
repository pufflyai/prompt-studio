import { HStack } from "@chakra-ui/react";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { readRecentHarnessSelection, saveRecentHarnessSelection } from "@/shared/command-params/recent-harness-param";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { useProject } from "@/shared/projects/use-project";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { useHarnessParamDefaults } from "../hooks/use-harness-param-defaults";
import { resolveRuntimeAgentSelection, resolveRuntimeModelSelection } from "../runtime/session-runtime-selection";
import { HarnessParamInlineControls } from "./harness-param-inline-controls";
import {
  filterHarnessParamValues,
  type HarnessParamValues,
  harnessParamValuesEqual,
  resolveHarnessParamDefaults,
} from "./harness-param-values";

interface SessionModelControlsProps {
  selectionScope?: "draft" | "request";
  view: DashboardSessionView;
  projectId: string | undefined;
  selectedAgent: string;
  setSelectedAgent: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  harnessParamOverrides: HarnessParamValues;
  setHarnessParamOverrides: Dispatch<SetStateAction<HarnessParamValues>>;
}

/** Agent, model, and harness-param controls that live in the chat input toolbar. */
export const SessionModelControls = (props: SessionModelControlsProps) => {
  const {
    view,
    selectionScope = "draft",
    projectId,
    selectedAgent,
    setSelectedAgent,
    selectedModel,
    setSelectedModel,
    harnessParamOverrides,
    setHarnessParamOverrides,
  } = props;
  const { data: project } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
    description: agent.availability.reason,
  }));
  const selectedAgentInfo = agents.find((agent) => agent.id === selectedAgent);
  const defaultAgent = project?.default_agent_id;
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === selectedAgent);
  const harnessParamDefaults = useHarnessParamDefaults(
    projectId,
    isResolvedAgent ? selectedAgent : undefined,
    selectedModel,
  );
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent) && isResolvedAgent,
    projectId,
  });
  const modelOptions = models.map((model) => ({
    label: model.label ?? model.id,
    value: model.id,
    description: model.description,
  }));
  if (selectedModel && !modelOptions.some((option) => option.value === selectedModel)) {
    modelOptions.push({ label: selectedModel, value: selectedModel, description: undefined });
  }
  const preferredModel = view.lastSelectedModel ?? project?.default_agent_model ?? "";
  const baseParamSchema = harnessParamDefaults.data?.schema ?? selectedAgentInfo?.params;
  const selectedModelInfo = findAgentModel(models, selectedModel);
  const effectiveParamSchema = resolveAgentModelParams(baseParamSchema, selectedModelInfo);
  const effectiveParamDefaults = resolveHarnessParamDefaults(effectiveParamSchema, harnessParamDefaults.data?.defaults);
  const displayedOverrides = Object.fromEntries(
    Object.entries(harnessParamOverrides).filter(([key, value]) => !Object.is(effectiveParamDefaults[key], value)),
  );

  useEffect(() => {
    const nextAgent = resolveRuntimeAgentSelection({
      agentOptions,
      selectedAgent,
      sessionAgent: view.agent,
      defaultAgent,
    });
    if (nextAgent !== selectedAgent) setSelectedAgent(nextAgent);
  }, [agentOptions, defaultAgent, selectedAgent, setSelectedAgent, view.agent]);

  useEffect(() => {
    if (isModelsLoading || selectionScope === "request") return;

    const nextModel = resolveRuntimeModelSelection({ models, selectedModel, preferredModel });
    if (nextModel !== selectedModel) setSelectedModel(nextModel);
  }, [isModelsLoading, models, preferredModel, selectedModel, setSelectedModel, selectionScope]);

  useEffect(() => {
    if (!baseParamSchema || isModelsLoading || (selectedModel && !selectedModelInfo)) return;
    setHarnessParamOverrides((current) => {
      const schema = resolveAgentModelParams(baseParamSchema, selectedModelInfo);
      const next = filterHarnessParamValues(schema, current);
      return harnessParamValuesEqual(current, next) ? current : next;
    });
  }, [baseParamSchema, isModelsLoading, selectedModel, selectedModelInfo, setHarnessParamOverrides]);

  // Explicit picks become the project's remembered selection, so the next
  // draft starts from them instead of the project defaults.
  const handleSelectAgent = (agent: string) => {
    setSelectedAgent(agent);
    setSelectedModel("");
    if (selectionScope === "request") return;
    const recent = readRecentHarnessSelection(projectId);
    const params = recent?.harnessId === agent ? (recent.params ?? {}) : {};
    setHarnessParamOverrides(params);
    saveRecentHarnessSelection(projectId, { harnessId: agent, params });
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    if (selectedAgent && selectionScope === "draft")
      saveRecentHarnessSelection(projectId, {
        harnessId: selectedAgent,
        ...(model ? { model } : {}),
        params: harnessParamOverrides,
      });
  };

  const handleParamChange = (overrides: HarnessParamValues) => {
    // Send explicit defaults too, so resetting a saved session value reaches the server.
    const params = { ...effectiveParamDefaults, ...overrides };
    setHarnessParamOverrides(params);
    if (selectionScope === "draft")
      saveRecentHarnessSelection(projectId, { harnessId: selectedAgent, model: selectedModel, params });
  };

  return (
    <HStack gap="2xs" minW="0">
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={isResolvedAgent ? selectedAgent : ""}
        onSelectAgent={handleSelectAgent}
        modelOptions={isResolvedAgent ? modelOptions : []}
        selectedModel={isResolvedAgent ? selectedModel : ""}
        onSelectModel={handleSelectModel}
        isAgentSwitchDisabled={Boolean(view.sessionId && view.agent)}
        isAgentsLoading={isAgentsLoading}
        isModelsLoading={isModelsLoading}
        size="xs"
      />
      <HarnessParamInlineControls
        schema={effectiveParamSchema ?? undefined}
        defaults={effectiveParamDefaults}
        overrides={displayedOverrides}
        onOverridesChange={handleParamChange}
        disabled={!isResolvedAgent}
        size="xs"
      />
    </HStack>
  );
};
