import { gitEvents, type MergePayload } from "@pstdio/sdk/extensions";
import {
  git as defaultGit,
  mergeWorktree as defaultMergeWorktree,
  removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch,
} from "pstdio-wt";
import { apiClient } from "@/features/api-client";
import { deleteWorkspace as defaultDeleteWorkspace } from "./api/delete-workspace";
import { getWorkspace as defaultGetWorkspace } from "./api/get-workspace";

type MergeWorkspaceInput = {
  repoRoot: string;
  projectId: string;
  workspaceShorthand: string;
  deleteAfter?: boolean;
};

type Deps = {
  getWorkspace: typeof defaultGetWorkspace;
  deleteWorkspace: typeof defaultDeleteWorkspace;
  isCleanWorkingTree: (repoRoot: string) => Promise<boolean>;
  squashMerge: (repoRoot: string, branch: string, message: string) => Promise<void>;
  fireGitMerged: (projectId: string, payload: MergePayload) => Promise<void>;
  abortMerge: (repoRoot: string) => Promise<void>;
  removeWorktreeAndBranch: (opts: { repoRoot: string; path: string; branch: string; force?: boolean }) => Promise<void>;
  log: (msg: string) => void;
};

const defaultIsCleanWorkingTree = async (repoRoot: string) => {
  const output = await defaultGit(repoRoot, ["status", "--porcelain"]);
  return output === "";
};

const defaultSquashMerge = async (repoRoot: string, branch: string, message: string) => {
  await defaultMergeWorktree({ repoRoot, branch, squash: true, message });
};

const defaultAbortMerge = async (repoRoot: string) => {
  await defaultGit(repoRoot, ["reset", "--merge"]);
};

const defaultFireGitMerged = async (projectId: string, payload: MergePayload) => {
  await apiClient().extensions.dispatchEvent(projectId, { eventId: gitEvents.merged.id, payload });
};

const toMergePayload = (
  projectId: string,
  repoRoot: string,
  branch: string,
  workspace: NonNullable<Awaited<ReturnType<Deps["getWorkspace"]>>>,
) => {
  const anchors = workspace.anchors_json as MergePayload["anchors"];
  return {
    projectId,
    repoPath: repoRoot,
    worktreePath: workspace.worktree_path ?? undefined,
    branch,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      project_id: workspace.project_id,
      workspace_shorthand: workspace.workspace_shorthand,
      branch: workspace.branch,
      worktree_path: workspace.worktree_path,
      anchors_json: anchors,
      created_at: workspace.created_at,
      updated_at: workspace.updated_at,
    },
    anchors,
  } satisfies MergePayload;
};

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspace,
  isCleanWorkingTree: defaultIsCleanWorkingTree,
  squashMerge: defaultSquashMerge,
  fireGitMerged: defaultFireGitMerged,
  abortMerge: defaultAbortMerge,
  removeWorktreeAndBranch: defaultRemoveWorktreeAndBranch,
  log: console.log,
};

const cleanupWorkspace = async (
  deps: Deps,
  root: string,
  workspaceId: string,
  worktreePath: string | null,
  branch: string,
) => {
  await deps.deleteWorkspace(workspaceId);
  if (worktreePath) {
    try {
      await deps.removeWorktreeAndBranch({ repoRoot: root, path: worktreePath, branch, force: true });
    } catch {
      // Already removed
    }
  }
};

const fireGitMergedSafely = async (deps: Deps, projectId: string, payload: MergePayload) => {
  try {
    await deps.fireGitMerged(projectId, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log(`Merged workspace, but git merged event dispatch failed: ${message}`);
  }
};

export const mergeWorkspace = async (input: MergeWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand, deleteAfter } = input;

  const clean = await deps.isCleanWorkingTree(repoRoot);
  if (!clean) throw new Error("Branch has uncommitted changes");

  const workspace = await deps.getWorkspace(projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);
  const canMerge =
    workspace.provider_state === "ready" &&
    workspace.execution_kind === "local" &&
    workspace.provider_capabilities_json.merge &&
    Boolean(workspace.worktree_path && workspace.branch);
  if (!canMerge) throw new Error(`Workspace cannot be merged: ${workspaceShorthand}`);

  const branch = workspace.branch!;
  const message = `workspace(${workspace.workspace_shorthand}): squash merge`;

  try {
    await deps.squashMerge(repoRoot, branch, message);
  } catch {
    await deps.abortMerge(repoRoot);
    throw new Error("Merge conflict");
  }

  if (deleteAfter) {
    await cleanupWorkspace(deps, repoRoot, workspace.id, workspace.worktree_path, branch);
    deps.log(`Merged workspace ${workspaceShorthand} and deleted workspace.`);
  } else {
    deps.log(`Merged workspace ${workspaceShorthand} as a squash commit.`);
  }

  await fireGitMergedSafely(deps, projectId, toMergePayload(projectId, repoRoot, branch, workspace));
};
