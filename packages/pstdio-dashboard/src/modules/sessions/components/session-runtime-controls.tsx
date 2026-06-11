import { Box, Flex } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import { useAgentModels } from "@/shared/agents/use-agent-models";
import { useAgents } from "@/shared/agents/use-agents";
import { WorkspaceAgentMenu } from "@/shared/components/workspace-agent-menu";
import { useProject } from "@/shared/projects/use-project";
import { createDashboardWorkspaceOptions } from "@/shared/workspaces/workspace-options";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeWorkspaceSelection,
} from "../runtime/session-runtime-selection";
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
  } = props;
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents(projectId);
  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
  }));
  const defaultAgent = project?.default_agent_id ?? fallbackAgentId;
  // A stored selection can point at a harness whose extension is disabled; treat it as
  // unselected so the menu shows its empty state instead of fetching 404ing models.
  const isResolvedAgent = agents.some((agent) => agent.id === selectedAgent);
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent) && isResolvedAgent,
    projectId,
  });
  const modelOptions = models.map((model) => ({ label: model.id, value: model.id }));
  if (selectedModel && !modelOptions.some((option) => option.value === selectedModel)) {
    modelOptions.push({ label: selectedModel, value: selectedModel });
  }
  const preferredModel = view.lastSelectedModel ?? project?.default_agent_model ?? "";
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
    const nextWorkspaceId = resolveRuntimeWorkspaceSelection({
      workspaces: workspaceOptions,
      selectedWorkspaceId,
      // A draft with no bound workspace falls back to the project's default (root repo).
      fallbackWorkspaceId: view.workspaceId ?? defaultWorkspaceId,
    });
    if (nextWorkspaceId !== selectedWorkspaceId) setSelectedWorkspaceId(nextWorkspaceId);
  }, [defaultWorkspaceId, selectedWorkspaceId, setSelectedWorkspaceId, view.workspaceId, workspaceOptions]);

  const handleSelectAgent = (agent: string) => {
    setSelectedAgent(agent);
    setSelectedModel("");
  };

  return (
    <Flex justifyContent="space-between" align="center" gap="2xs" w="full" minW="0" px="xs" pb="xs" wrap="nowrap">
      <Box flexShrink="0">
        <WorkspaceAgentMenu
          agentOptions={agentOptions}
          selectedAgent={isResolvedAgent ? selectedAgent : ""}
          onSelectAgent={handleSelectAgent}
          modelOptions={isResolvedAgent ? modelOptions : []}
          selectedModel={isResolvedAgent ? selectedModel : ""}
          onSelectModel={setSelectedModel}
          isAgentSwitchDisabled={Boolean(view.sessionId && view.agent)}
          isAgentsLoading={isAgentsLoading}
          isModelsLoading={isModelsLoading}
        />
      </Box>
      <SessionWorkspaceMenu
        workspaces={workspaceOptions}
        selectedWorkspaceId={selectedWorkspaceId}
        selectedWorkspaceLabel={selectedWorkspaceLabel}
        onSelectWorkspace={setSelectedWorkspaceId}
        isDisabled={isExistingSession || isProjectLoading}
      />
    </Flex>
  );
};
