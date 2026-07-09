import { Stack } from "@chakra-ui/react";
import type { WorkbenchCore } from "@pstdio/workbench/core";
import type { CommandParamFieldProps } from "@pstdio/workbench/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { RepoBrowser } from "@/shared/components/repo-browser";
import type { ProjectRepository, RepoBranch } from "@/shared/projects/project-types";
import { useProject } from "@/shared/projects/use-project";
import { useRepoBranches } from "@/shared/projects/use-repo-branches";
import { ParamFieldLabel, parseParamRecord, serializeParamRecord } from "./param-field-shared";

interface RepoParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const resolveRepository = (repositories: ProjectRepository[], selected: string) => {
  if (repositories.some((repository) => repository.id === selected)) return selected;
  return repositories[0]?.id ?? "";
};

const resolveBranch = (branches: RepoBranch[], selected: string) => {
  if (branches.some((branch) => branch.name === selected)) return selected;
  return branches.find((branch) => branch.isCurrent)?.name ?? branches[0]?.name ?? "";
};

const readRepo = (value: CommandParamFieldProps["value"]) => {
  const record = parseParamRecord(value);
  return {
    repoId: typeof record.repoId === "string" ? record.repoId : "",
    branch: typeof record.branch === "string" ? record.branch : "",
  };
};

const getBranchLabel = (branch: RepoBranch, currentTag: string, remoteTag: string) => {
  if (branch.isCurrent) return `${branch.name} (${currentTag})`;
  if (branch.isRemote) return `${branch.name} (${remoteTag})`;
  return branch.name;
};

export const RepoParamField = (props: RepoParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const { t } = useTranslation("projects");
  const projectId = getDashboardSelectedProjectId(workbench);
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);
  const { repoId, branch } = readRepo(value);
  const { data: branches = [], isLoading: isBranchesLoading } = useRepoBranches(repoId, {
    enabled: Boolean(repoId),
  });

  const repositories = project?.repositories ?? [];
  const repositoryOptions = repositories.map((repository) => ({
    label: repository.displayName ?? repository.name,
    value: repository.id,
  }));
  const branchOptions = branches.map((option) => ({
    label: getBranchLabel(option, t("chatInput.branch.tags.current"), t("chatInput.branch.tags.remote")),
    value: option.name,
  }));
  if (branch && !branchOptions.some((option) => option.value === branch)) {
    branchOptions.push({ label: branch, value: branch });
  }

  useEffect(() => {
    const next = resolveRepository(repositories, repoId);
    if (next && next !== repoId) onChange(serializeParamRecord({ repoId: next }));
  }, [repositories, repoId, onChange]);

  useEffect(() => {
    if (isBranchesLoading || !repoId) return;
    const next = resolveBranch(branches, branch);
    if (next && next !== branch) onChange(serializeParamRecord({ repoId, branch: next }));
  }, [branches, isBranchesLoading, repoId, branch, onChange]);

  const handleSelectRepository = (repository: string) => onChange(serializeParamRecord({ repoId: repository }));
  const handleSelectBranch = (selected: string) => onChange(serializeParamRecord({ repoId, branch: selected }));

  return (
    <Stack gap="2xs">
      <ParamFieldLabel entry={entry} />
      <RepoBrowser
        repositoryOptions={repositoryOptions}
        selectedRepository={repoId}
        onSelectRepository={handleSelectRepository}
        branchOptions={branchOptions}
        selectedBranch={branch}
        onSelectBranch={handleSelectBranch}
        isDisabled={disabled}
        isReposLoading={isProjectLoading}
        isBranchesLoading={isBranchesLoading}
        maxListHeight="26rem"
      />
    </Stack>
  );
};
