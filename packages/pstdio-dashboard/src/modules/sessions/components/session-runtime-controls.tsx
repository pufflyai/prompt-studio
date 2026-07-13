import { Flex } from "@chakra-ui/react";
import { findAgentModel, resolveAgentModelParams } from "pstdio-api-contracts/agent-model-params";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { saveRecentHarnessSelection } from "@/shared/command-params/recent-harness-param";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { useProject } from "@/shared/projects/use-project";
import { createDashboardWorkspaceOptions, type DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { useHarnessParamDefaults } from "../hooks/use-harness-param-defaults";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeWorkspaceSelection,
} from "../runtime/session-runtime-selection";
import { HarnessParamControls, type HarnessParamValues } from "./harness-param-controls";
import { filterHarnessParamValues, harnessParamValuesEqual } from "./harness-param-values";
import { SessionWorkspaceMenu } from "./session-workspace-menu";

const fallbackAgentId = "pstdio.harness-open-code.opencode";

interface SessionRuntimeControlsProps {
  view: DashboardSessionView;
  projectId: string | undefined;
  selectedAgent: string;
  setSelectedAgent: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  selectedWorkspaceId: string;
  setSelectedWorkspaceId: Dispatch<SetStateAction<string>>;
  harnessParamOverrides: HarnessParamValues;
  setHarnessParamOverrides: Dispatch<SetStateAction<HarnessParamValues>>;
  onSelectWorkspace?: (workspace: DashboardWorkspaceOption) => void;
}

const getSelectedWorkspaceLabel = (input: {
  selectedWorkspaceId: string;
  workspaceTitle: string;
  workspaceShorthand: string;
  workspaces: ReturnType<typeof createDashboardWorkspaceOptions>;
}) => {
  const selected = input.workspaces.find((workspace) => workspace.id === input.selectedWorkspaceId);
  if (selected) return selected.title;
  return input.workspaceTitle || input.workspaceShorthand;
};

export const SessionRuntimeControls = (props: SessionRuntimeControlsProps) => {
  const {
    view,
    projectId,
    selectedAgent,
    setSelectedAgent,
    selectedModel,
    setSelectedModel,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    harnessParamOverrides,
    setHarnessParamOverrides,
    onSelectWorkspace,
  } = props;
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
  }));
  const selectedAgentInfo = agents.find((agent) => agent.id === selectedAgent);
  const defaultAgent = project?.default_agent_id ?? fallbackAgentId;
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === selectedAgent);
  const harnessParamDefaults = useHarnessParamDefaults(projectId, isResolvedAgent ? selectedAgent : undefined);
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
  const effectiveParamDefaults = filterHarnessParamValues(effectiveParamSchema, harnessParamDefaults.data?.defaults);
  const workspaceOptions = createDashboardWorkspaceOptions(projectId);
  const defaultWorkspaceId = workspaceOptions.find((workspace) => workspace.isDefault)?.id ?? null;
  const selectedWorkspaceLabel = getSelectedWorkspaceLabel({
    selectedWorkspaceId,
    workspaceTitle: view.workspaceTitle,
    workspaceShorthand: view.workspaceShorthand,
    workspaces: workspaceOptions,
  });
  const isExistingSession = Boolean(view.sessionId);

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
    if (isModelsLoading) return;

    const nextModel = resolveRuntimeModelSelection({
      models,
      selectedModel,
      preferredModel,
    });
    if (nextModel !== selectedModel) setSelectedModel(nextModel);
  }, [isModelsLoading, models, preferredModel, selectedModel, setSelectedModel]);

  useEffect(() => {
    setHarnessParamOverrides((current) => {
      const schema = resolveAgentModelParams(baseParamSchema, selectedModelInfo);
      const next = filterHarnessParamValues(schema, current);
      return harnessParamValuesEqual(current, next) ? current : next;
    });
  }, [baseParamSchema, selectedModelInfo, setHarnessParamOverrides]);

  useEffect(() => {
    const nextWorkspaceId = resolveRuntimeWorkspaceSelection({
      workspaces: workspaceOptions,
      selectedWorkspaceId,
      // A draft with no bound workspace falls back to the project's default (root repo).
      fallbackWorkspaceId: view.workspaceId ?? defaultWorkspaceId,
    });
    if (nextWorkspaceId !== selectedWorkspaceId) setSelectedWorkspaceId(nextWorkspaceId);
  }, [defaultWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId, view.workspaceId, workspaceOptions]);

  // Explicit picks become the project's remembered selection, so the next
  // draft starts from them instead of the project defaults.
  const handleSelectAgent = (agent: string) => {
    setSelectedAgent(agent);
    setSelectedModel("");
    setHarnessParamOverrides({});
    saveRecentHarnessSelection(projectId, { harnessId: agent });
  };

  const handleSelectModel = (model: string) => {
    setSelectedModel(model);
    if (selectedAgent) saveRecentHarnessSelection(projectId, { harnessId: selectedAgent, ...(model ? { model } : {}) });
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    const workspace = workspaceOptions.find((option) => option.id === workspaceId);
    setSelectedWorkspaceId(workspaceId);
    if (workspace) onSelectWorkspace?.(workspace);
  };

  return (
    <Flex justifyContent="space-between" align="center" gap="2xs" w="full" minW="0" px="xs" pb="xs" wrap="wrap">
      <Flex align="center" justify="flex-end" gap="2xs" minW="0" wrap="wrap">
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
        />
        <HarnessParamControls
          schema={effectiveParamSchema ?? undefined}
          defaults={effectiveParamDefaults}
          overrides={harnessParamOverrides}
          onOverridesChange={setHarnessParamOverrides}
          disabled={!isResolvedAgent}
        />
      </Flex>
      <SessionWorkspaceMenu
        workspaces={workspaceOptions}
        selectedWorkspaceId={selectedWorkspaceId}
        selectedWorkspaceLabel={selectedWorkspaceLabel}
        onSelectWorkspace={handleSelectWorkspace}
        isDisabled={isExistingSession || isProjectLoading}
      />
    </Flex>
  );
};
