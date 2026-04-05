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

export type HookDispatch = {
  firePreHook(hookName: string, ctx: unknown): Promise<{ rejected: boolean; reason?: string }>;
  firePostHook(hookName: string, ctx: unknown): Promise<void>;
};

export type BranchInfo = {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommitDate: string;
};
