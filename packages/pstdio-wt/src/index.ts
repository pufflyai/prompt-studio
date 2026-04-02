export { listBranches } from "./branches";
export { commitChanges } from "./commit";
export { copyIgnored } from "./copy-ignored";
export type { DiffSummary, FileDiff, WorktreeDiff } from "./diff";
export { getWorktreeDiff, getWorktreeDiffSummary } from "./diff";
export { GitError, git } from "./git";
export {
  buildEnvFromPayload,
  isAttemptStatusHook,
  isBlockingHook,
  listHooks,
  parsePayloadOverride,
  resolveHookScript,
  runHook,
} from "./hooks";
export { mergeWorktree } from "./merge";
export { rebaseOntoTarget } from "./rebase";
export { runSetup, runSetupScript } from "./setup";
export { getWorktreeStatus } from "./status";
export type {
  AttemptStatusHookName,
  BranchInfo,
  CommitResult,
  HookName,
  HookPayload,
  HookResult,
  MergeResult,
  RebaseResult,
  RunHookOptions,
  SessionHookName,
  SetupResult,
  StagingPolicy,
  TicketHookName,
  WorktreeHookName,
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
