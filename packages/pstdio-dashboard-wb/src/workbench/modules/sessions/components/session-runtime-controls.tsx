import { Box, Flex } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardSessionView } from "../../../data/dashboard-data";
import { RepoBrowser } from "../../../shared/components/repo-browser";
import { WorkspaceAgentMenu } from "../../../shared/components/workspace-agent-menu";
import { dashboardSelectedProjectIdContextKey } from "../../../shared/project-context";
import type { RepoBranch } from "../../settings/data/project-types";
import { useAgentModels } from "../../settings/hooks/use-agent-models";
import { useAgents } from "../../settings/hooks/use-agents";
import { useProject } from "../../settings/hooks/use-project";
import { useRepoBranches } from "../../settings/hooks/use-repo-branches";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeBranchSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeRepositorySelection,
} from "../session-runtime-selection";

const fallbackAgentId = "opencode";

interface SessionRuntimeControlsProps {
  input: WorkbenchWidgetRenderInput;
  view: DashboardSessionView;
}

const getBranchLabel = (branch: RepoBranch, currentBranchTag: string, remoteBranchTag: string) => {
  if (branch.isCurrent) return `${branch.name} (${currentBranchTag})`;
  if (branch.isRemote) return `${branch.name} (${remoteBranchTag})`;
  return branch.name;
};

export const SessionRuntimeControls = (props: SessionRuntimeControlsProps) => {
  const { input, view } = props;
  const { t } = useTranslation("projects");
  const projectIdValue = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const { data: project, isLoading: isProjectLoading } = useProject(projectIdValue);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(view.agent ?? "");
  const [selectedModel, setSelectedModel] = useState(view.lastSelectedModel ?? "");
  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
  }));
  const defaultAgent = project?.default_agent_id ?? fallbackAgentId;
  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent),
  });
  const modelOptions = models.map((model) => ({ label: model.id, value: model.id }));
  if (selectedModel && !modelOptions.some((option) => option.value === selectedModel)) {
    modelOptions.push({ label: selectedModel, value: selectedModel });
  }
  const preferredModel = view.lastSelectedModel ?? project?.default_agent_model ?? "";
  const [selectedRepository, setSelectedRepository] = useState("");
  const { data: branches = [], isLoading: isBranchesLoading } = useRepoBranches(selectedRepository, {
    enabled: Boolean(selectedRepository),
  });
  const [selectedBranch, setSelectedBranch] = useState(view.workspaceBranch ?? "");
  const repositoryOptions =
    project?.repositories.map((repository) => ({
      label: repository.displayName ?? repository.name,
      value: repository.id,
    })) ?? [];
  const branchOptions = branches.map((branch) => ({
    label: getBranchLabel(branch, t("chatInput.branch.tags.current"), t("chatInput.branch.tags.remote")),
    value: branch.name,
  }));
  if (selectedBranch && !branchOptions.some((option) => option.value === selectedBranch)) {
    branchOptions.push({ label: selectedBranch, value: selectedBranch });
  }

  useEffect(() => {
    setSelectedAgent(view.agent ?? "");
    setSelectedModel(view.lastSelectedModel ?? "");
    setSelectedBranch(view.workspaceBranch ?? "");
  }, [view.agent, view.lastSelectedModel, view.workspaceBranch]);

  useEffect(() => {
    const nextAgent = resolveRuntimeAgentSelection({
      agentOptions,
      selectedAgent,
      sessionAgent: view.agent,
      defaultAgent,
    });
    if (nextAgent !== selectedAgent) setSelectedAgent(nextAgent);
  }, [agentOptions, defaultAgent, selectedAgent, view.agent]);

  useEffect(() => {
    if (isModelsLoading) return;

    const nextModel = resolveRuntimeModelSelection({
      models,
      selectedModel,
      preferredModel,
    });
    if (nextModel !== selectedModel) setSelectedModel(nextModel);
  }, [isModelsLoading, models, preferredModel, selectedModel]);

  useEffect(() => {
    const nextRepository = resolveRuntimeRepositorySelection({
      repositories: project?.repositories ?? [],
      selectedRepository,
    });
    if (nextRepository !== selectedRepository) setSelectedRepository(nextRepository);
  }, [project, selectedRepository]);

  useEffect(() => {
    if (isBranchesLoading) return;

    const nextBranch = resolveRuntimeBranchSelection({
      branches,
      selectedBranch,
      lockedBranch: view.workspaceBranch,
    });
    if (nextBranch !== selectedBranch) setSelectedBranch(nextBranch);
  }, [branches, isBranchesLoading, selectedBranch, view.workspaceBranch]);

  const handleSelectAgent = (agent: string) => {
    setSelectedAgent(agent);
    setSelectedModel("");
  };

  const handleSelectRepository = (repository: string) => {
    setSelectedRepository(repository);
    setSelectedBranch("");
  };

  return (
    <Flex justifyContent="space-between" align="center" gap="2xs" w="full" minW="0" px="xs" pb="xs" wrap="nowrap">
      <Box flexShrink="0">
        <WorkspaceAgentMenu
          agentOptions={agentOptions}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
          modelOptions={modelOptions}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          isAgentSwitchDisabled={Boolean(view.sessionId && view.agent)}
          isAgentsLoading={isAgentsLoading}
          isModelsLoading={isModelsLoading}
        />
      </Box>
      <RepoBrowser
        repositoryOptions={repositoryOptions}
        selectedRepository={selectedRepository}
        onSelectRepository={handleSelectRepository}
        branchOptions={branchOptions}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
        isDisabled={Boolean(view.sessionId)}
        isReposLoading={isProjectLoading}
        isBranchesLoading={isBranchesLoading}
      />
    </Flex>
  );
};
