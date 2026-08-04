import { ParamEditorRow, type SelectionOption, type SelectionParam } from "@pstdio/ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { type CommandParamFieldProps, commandParamName } from "@pstdio/workbench/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { ProjectRepository, RepoBranch } from "@/shared/projects/project-types";
import { useProject } from "@/shared/projects/use-project";
import { useRepoBranches } from "@/shared/projects/use-repo-branches";
import { parseParamRecord, serializeParamRecord } from "./param-field-shared";

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

  const workspaceOptions: SelectionOption[] = branchOptions.map((option) => ({
    id: option.value,
    name: option.label,
    icon: "GitBranch",
  }));
  if (isBranchesLoading && workspaceOptions.length === 0) {
    workspaceOptions.push({ id: "branch-loading", name: "Loading workspaces…", icon: "GitBranch", disabled: true });
  }
  const workspaceParam: SelectionParam = {
    id: "branch",
    name: commandParamName(entry),
    description: entry.description,
    type: "selection",
    defaultValue: branch,
    options: workspaceOptions,
    placeholder: "Select workspace",
    searchable: branchOptions.length > 10,
    searchPlaceholder: "Search workspaces…",
    emptyText: "No workspaces available",
    disabled: disabled || (repositories.length === 0 && !isProjectLoading),
    group: {
      id: "repoId",
      name: "Repository",
      defaultValue: repoId,
      options: repositoryOptions.map((option) => ({ id: option.value, name: option.label, icon: "FolderGit2" })),
      placeholder: isProjectLoading ? "Loading repositories…" : "Select repository",
      searchable: repositoryOptions.length > 10,
      searchPlaceholder: "Search repositories…",
      emptyText: "No repositories linked",
      disabled: disabled || isProjectLoading || repositoryOptions.length <= 1,
    },
  };

  return (
    <ParamEditorRow
      param={workspaceParam}
      values={{ branch, repoId }}
      onChange={(id, nextValue) => {
        if (typeof nextValue !== "string") return;
        if (id === "repoId") handleSelectRepository(nextValue);
        if (id === "branch") handleSelectBranch(nextValue);
      }}
    />
  );
};
