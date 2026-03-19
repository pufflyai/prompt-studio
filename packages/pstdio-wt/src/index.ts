export { listBranches } from "./branches";
export { commitChanges } from "./commit";
export { copyIgnored } from "./copy-ignored";
export type { FileDiff, WorktreeDiff } from "./diff";
export { getWorktreeDiff } from "./diff";
export { GitError, git } from "./git";
export { buildHookEnv, isBlockingHook, listHooks, resolveHookScript, runHook } from "./hooks";
export { mergeWorktree } from "./merge";
export { rebaseOntoTarget } from "./rebase";
export { runSetup, runSetupScript } from "./setup";
export { getWorktreeStatus } from "./status";
export type {
  BranchInfo,
  CommitResult,
  HookContext,
  HookName,
  HookResult,
  MergeResult,
  RebaseResult,
  SetupResult,
  StagingPolicy,
  WorktreeInfo,
  WorktreeStatus,
} from "./types";
export {
  branchExists,
  createWorktree,
  findWorktreeByBranch,
  listWorktrees,
  removeWorktree,
  removeWorktreeAndBranch,
  worktreePath,
} from "./worktree";
