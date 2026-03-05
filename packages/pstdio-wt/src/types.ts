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
