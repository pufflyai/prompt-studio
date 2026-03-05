import {
  git as defaultGit,
  mergeWorktree as defaultMergeWorktree,
  removeWorktreeAndBranch as defaultRemoveWorktreeAndBranch,
} from "pstdio-wt";
import { API_URL } from "@/features/api-url";
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

const defaultDeps: Deps = {
  getWorkspace: defaultGetWorkspace,
  deleteWorkspace: defaultDeleteWorkspace,
  isCleanWorkingTree: defaultIsCleanWorkingTree,
  squashMerge: defaultSquashMerge,
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
  await deps.deleteWorkspace(API_URL, workspaceId);
  if (worktreePath) {
    try {
      await deps.removeWorktreeAndBranch({ repoRoot: root, path: worktreePath, branch, force: true });
    } catch {
      // Already removed
    }
  }
};

export const mergeWorkspace = async (input: MergeWorkspaceInput, deps: Deps = defaultDeps) => {
  const { repoRoot, projectId, workspaceShorthand, deleteAfter } = input;

  const clean = await deps.isCleanWorkingTree(repoRoot);
  if (!clean) throw new Error("Branch has uncommitted changes");

  const workspace = await deps.getWorkspace(API_URL, projectId, workspaceShorthand);
  if (!workspace) throw new Error(`Workspace not found: ${workspaceShorthand}`);

  const branch = workspace.branch ?? `workspace/${workspace.workspace_shorthand}`;
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
};
