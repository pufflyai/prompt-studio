export type WorktreeInfo = {
  branch: string;
  path: string;
  base: string;
  created: boolean;
};

export type WorktreeStatus = {
  branch: string;
  path: string;
  dirty: boolean;
  conflicts: boolean;
  aheadOfBase: number;
  behindBase: number;
  lastCommitSha: string;
  lastCommitMessage: string;
};

export type SetupResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CommitResult = {
  sha: string;
  message: string;
};

export type MergeResult = {
  merged: boolean;
  target: string;
  sha: string;
};

export type RebaseResult = {
  rebased: boolean;
  upToDate: boolean;
};

export type StagingPolicy = "all" | "tracked" | "none";

export type BranchInfo = {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommitDate: string;
};

export type WorktreeHookName =
  | "pre-worktree-create"
  | "post-worktree-create"
  | "pre-commit"
  | "post-commit"
  | "pre-rebase"
  | "post-rebase"
  | "pre-merge"
  | "post-merge"
  | "pre-worktree-remove"
  | "post-worktree-remove"
  | "on-conflict";

export type SessionHookName =
  | "post-session-start"
  | "post-session-success"
  | "post-session-fail"
  | "post-session-resume"
  | "post-session-await-input";

export type TicketHookName =
  | "pre-ticket-creation"
  | "post-ticket-creation"
  | "pre-ticket-status-change"
  | "post-ticket-status-change"
  | "pre-ticket-archive"
  | "post-ticket-archive"
  | "pre-ticket-deletion"
  | "post-ticket-deletion";

export type HookName = WorktreeHookName | SessionHookName | TicketHookName;

export type HookPayload = Record<string, unknown>;

export type RunHookOptions = {
  repoPath: string;
  cwd?: string;
  timeoutMs?: number;
};

export type HookResult = SetupResult & {
  hook: HookName;
  skipped: boolean;
};
