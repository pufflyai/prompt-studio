import { Box, Flex } from "@chakra-ui/react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardSessionView } from "../../../modules/sessions/data/dashboard-sessions";
import { RepoBrowser } from "../../components/repo-browser";
import { WorkspaceAgentMenu } from "../../components/workspace-agent-menu";
import type { RepoBranch } from "../../runtime/project-types";
import { useAgentModels } from "../../runtime/use-agent-models";
import { useAgents } from "../../runtime/use-agents";
import { useProject } from "../../runtime/use-project";
import { useRepoBranches } from "../../runtime/use-repo-branches";
import {
  resolveRuntimeAgentSelection,
  resolveRuntimeBranchSelection,
  resolveRuntimeModelSelection,
  resolveRuntimeRepositorySelection,
} from "../session-runtime-selection";

const fallbackAgentId = "opencode";

interface SessionRuntimeControlsProps {
  view: DashboardSessionView;
  projectId: string | undefined;
  selectedAgent: string;
  setSelectedAgent: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
}

const getBranchLabel = (branch: RepoBranch, currentBranchTag: string, remoteBranchTag: string) => {
  if (branch.isCurrent) return `${branch.name} (${currentBranchTag})`;
  if (branch.isRemote) return `${branch.name} (${remoteBranchTag})`;
  return branch.name;
};

export const SessionRuntimeControls = (props: SessionRuntimeControlsProps) => {
  const { view, projectId, selectedAgent, setSelectedAgent, selectedModel, setSelectedModel } = props;
  const { t } = useTranslation("projects");
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
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
    setSelectedBranch(view.workspaceBranch ?? "");
  }, [view.workspaceBranch]);

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
