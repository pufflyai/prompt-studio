import { Stack, Text } from "@chakra-ui/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CodingAgent } from "@/features/agents/agent-storage";
import { WorkspaceAgentMenu } from "@/features/agents/components/agent-browser";
import { useAgentModels } from "@/features/agents/hooks/use-agent-models";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { useProjectRepositories } from "@/features/project/hooks/use-project";
import { useRepoBranches } from "@/features/project/hooks/use-repo-branches";
import type { RepoBranch } from "@/features/project/types";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { RepoBrowser } from "@/features/workspaces/components/repo-browser";
import { resolveBranchState } from "@/features/workspaces/components/repo-browser.container";
import type { ActionParamDescriptor, ActionParamValue } from "../api";

interface CompositeFieldProps {
  param: ActionParamDescriptor;
  onChange: (value: ActionParamValue) => void;
  isDisabled: boolean;
}

interface RepoParamFieldProps extends CompositeFieldProps {
  projectId: string;
}

const DEFAULT_AGENT_ID = "opencode";

const getBranchLabel = (branch: RepoBranch, currentBranchTag: string, remoteBranchTag: string) => {
  if (branch.isCurrent) {
    return `${branch.name} (${currentBranchTag})`;
  }

  if (branch.isRemote) {
    return `${branch.name} (${remoteBranchTag})`;
  }

  return branch.name;
};

const ActionFieldContainer = (props: { label: string; description?: string; children: ReactNode }) => {
  const { label, description, children } = props;
  return (
    <Stack gap="xs">
      <Text textStyle="label/S/medium">{label}</Text>
      {description ? (
        <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
          {description}
        </Text>
      ) : null}
      {children}
    </Stack>
  );
};

export const AgentParamField = (props: CompositeFieldProps) => {
  const { param, onChange, isDisabled } = props;
  const lastSelectedAgent = useProjectSettingsStore((state) => state.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((state) => state.lastSelectedModels);
  const setLastSelectedAgent = useProjectSettingsStore((state) => state.setLastSelectedAgent);
  const setLastSelectedModel = useProjectSettingsStore((state) => state.setLastSelectedModel);
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();

  const emitChangeRef = useRef(onChange);
  emitChangeRef.current = onChange;

  const [selectedAgent, setSelectedAgent] = useState<CodingAgent>(
    (lastSelectedAgent ?? DEFAULT_AGENT_ID) as CodingAgent,
  );
  const [selectedModel, setSelectedModel] = useState(lastSelectedModels[0] ?? "");

  const agentOptions = agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
    disabled: agent.availability.type === "NOT_FOUND",
  }));

  const { data: models = [], isLoading: isModelsLoading } = useAgentModels(selectedAgent, {
    enabled: Boolean(selectedAgent),
  });

  useEffect(() => {
    emitChangeRef.current({ agent: selectedAgent, model: selectedModel });
  }, [selectedAgent, selectedModel]);

  useEffect(() => {
    if (isAgentsLoading) return;

    const selectableAgents = agentOptions.filter((option) => !option.disabled);
    if (selectableAgents.length === 0) return;
    if (selectableAgents.some((option) => option.value === selectedAgent)) return;

    const preferred = selectableAgents.find((option) => option.value === lastSelectedAgent)?.value;
    const nextAgent = preferred ?? selectableAgents[0]?.value;
    if (!nextAgent) return;

    setSelectedAgent(nextAgent as CodingAgent);
    setSelectedModel("");
    setLastSelectedAgent(nextAgent as CodingAgent);
  }, [agentOptions, isAgentsLoading, lastSelectedAgent, selectedAgent, setLastSelectedAgent]);

  useEffect(() => {
    if (isModelsLoading) return;

    if (models.length === 0) {
      if (!selectedModel) return;
      setSelectedModel("");
      return;
    }

    if (models.some((model) => model.id === selectedModel)) return;

    const preferred = lastSelectedModels.find((modelId) => models.some((model) => model.id === modelId));
    const nextModel = preferred ?? models[0]?.id ?? "";
    if (!nextModel) return;

    setSelectedModel(nextModel);
    setLastSelectedModel(nextModel);
  }, [isModelsLoading, lastSelectedModels, models, selectedModel, setLastSelectedModel]);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgent(agentId as CodingAgent);
    setSelectedModel("");
    setLastSelectedAgent(agentId as CodingAgent);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setLastSelectedModel(modelId);
  };

  const modelOptions = models
    .map((model) => ({ label: model.id, value: model.id }))
    .sort((a, b) => {
      const aIndex = lastSelectedModels.indexOf(a.value);
      const bIndex = lastSelectedModels.indexOf(b.value);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });

  return (
    <ActionFieldContainer label={param.label} description={param.description}>
      <WorkspaceAgentMenu
        agentOptions={agentOptions}
        selectedAgent={selectedAgent || DEFAULT_AGENT_ID}
        onSelectAgent={handleSelectAgent}
        modelOptions={modelOptions}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        isDisabled={isDisabled}
        isAgentsLoading={isAgentsLoading}
        isModelsLoading={isModelsLoading}
      />
    </ActionFieldContainer>
  );
};

export const RepoParamField = (props: RepoParamFieldProps) => {
  const { param, projectId, onChange, isDisabled } = props;
  const { t } = useTranslation("projects");
  const lastSelectedRepo = useProjectSettingsStore((state) => state.lastSelectedRepo);
  const lastSelectedBranches = useProjectSettingsStore((state) => state.lastSelectedBranches);
  const setLastSelectedRepo = useProjectSettingsStore((state) => state.setLastSelectedRepo);
  const setLastSelectedBranch = useProjectSettingsStore((state) => state.setLastSelectedBranch);
  const [selectedRepoId, setSelectedRepoId] = useState(lastSelectedRepo);
  const [selectedBranch, setSelectedBranch] = useState(lastSelectedBranches[0] ?? "");
  const [hasUserSelectedBranch, setHasUserSelectedBranch] = useState(false);
  const { data: repositories = [], isLoading: isRepositoriesLoading } = useProjectRepositories(projectId);

  const emitChangeRef = useRef(onChange);
  emitChangeRef.current = onChange;

  useEffect(() => {
    emitChangeRef.current({ repo: selectedRepoId, branch: selectedBranch });
  }, [selectedBranch, selectedRepoId]);

  useEffect(() => {
    if (isRepositoriesLoading) return;

    if (repositories.length === 0) {
      if (!selectedRepoId && !selectedBranch) return;
      setSelectedRepoId("");
      setSelectedBranch("");
      setHasUserSelectedBranch(false);
      return;
    }

    if (repositories.some((repository) => repository.id === selectedRepoId)) return;

    const preferred =
      lastSelectedRepo && repositories.some((repository) => repository.id === lastSelectedRepo)
        ? lastSelectedRepo
        : null;
    const nextRepoId = preferred ?? repositories[0]?.id ?? "";
    if (!nextRepoId) return;

    setSelectedRepoId(nextRepoId);
    setSelectedBranch("");
    setHasUserSelectedBranch(false);
    setLastSelectedRepo(nextRepoId);
  }, [isRepositoriesLoading, lastSelectedRepo, repositories, selectedBranch, selectedRepoId, setLastSelectedRepo]);

  const { data: branches = [], isLoading: isBranchesLoading } = useRepoBranches(selectedRepoId, {
    enabled: Boolean(selectedRepoId),
  });
  const currentBranch = branches.find((branch) => branch.isCurrent)?.name;

  useEffect(() => {
    const nextState = resolveBranchState({
      isLocked: false,
      isBranchesPending: isBranchesLoading,
      selectedRepositoryId: selectedRepoId,
      branches,
      currentBranch,
      selectedBranch,
      hasUserSelectedBranch,
    });
    if (!nextState) return;

    if (nextState.selectedBranch !== selectedBranch) {
      setSelectedBranch(nextState.selectedBranch);
      if (nextState.shouldPersistBranch) {
        setLastSelectedBranch(nextState.selectedBranch);
      }
    }

    if (nextState.hasUserSelectedBranch !== hasUserSelectedBranch) {
      setHasUserSelectedBranch(nextState.hasUserSelectedBranch);
    }
  }, [
    branches,
    currentBranch,
    hasUserSelectedBranch,
    isBranchesLoading,
    selectedBranch,
    selectedRepoId,
    setLastSelectedBranch,
  ]);

  const handleSelectRepo = (repoId: string) => {
    setSelectedRepoId(repoId);
    setSelectedBranch("");
    setHasUserSelectedBranch(false);
    setLastSelectedRepo(repoId);
  };

  const handleSelectBranch = (branch: string) => {
    setSelectedBranch(branch);
    setHasUserSelectedBranch(true);
    setLastSelectedBranch(branch);
  };

  const repoOptions = repositories.map((repository) => ({
    label: repository.displayName ?? repository.name,
    value: repository.id,
  }));
  const branchOptions = branches.map((branch) => ({
    label: getBranchLabel(branch, t("chatInput.branch.tags.current"), t("chatInput.branch.tags.remote")),
    value: branch.name,
  }));

  return (
    <ActionFieldContainer label={param.label} description={param.description}>
      <RepoBrowser
        repositoryOptions={repoOptions}
        selectedRepository={selectedRepoId}
        onSelectRepository={handleSelectRepo}
        branchOptions={branchOptions}
        selectedBranch={selectedBranch}
        onSelectBranch={handleSelectBranch}
        isDisabled={isDisabled}
        isReposLoading={isRepositoriesLoading}
        isBranchesLoading={isBranchesLoading}
      />
    </ActionFieldContainer>
  );
};
