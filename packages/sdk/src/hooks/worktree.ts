import type { BaseHookContext } from "./base";
import type { HookResourceAnchor } from "./entities";

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type WorktreeCreateContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  base: string;
  anchors?: HookResourceAnchor[];
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type WorktreeContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  anchors?: HookResourceAnchor[];
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type CommitContext = {
  repoPath: string;
  worktreePath: string;
  commitMessage: string;
  stagePolicy: string;
  commitSha?: string;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type RebaseContext = {
  repoPath: string;
  branch: string;
  target: string;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type MergeContext = {
  repoPath: string;
  branch: string;
  target: string;
  squash: boolean;
  commitMessage: string | null;
  commitSha?: string;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type ConflictContext = {
  repoPath: string;
  branch: string;
  target: string;
  operation: "rebase" | "merge";
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type WorktreeRemoveContext = {
  repoPath: string;
  worktreePath: string | null;
  branch: string;
  workspace: string;
  workspaceId: string;
  anchors?: HookResourceAnchor[];
  projectId: string;
};
