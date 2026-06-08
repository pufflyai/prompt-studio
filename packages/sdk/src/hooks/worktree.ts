import type { BaseHookContext } from "./base";
import type { HookResourceAnchor } from "./entities";

export type WorktreeCreateContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  base: string;
  anchors?: HookResourceAnchor[];
};

export type WorktreeContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  anchors?: HookResourceAnchor[];
};

export type CommitContext = {
  repoPath: string;
  worktreePath: string;
  commitMessage: string;
  stagePolicy: string;
  commitSha?: string;
};

export type RebaseContext = {
  repoPath: string;
  branch: string;
  target: string;
};

export type MergeContext = {
  repoPath: string;
  branch: string;
  target: string;
  squash: boolean;
  commitMessage: string | null;
  commitSha?: string;
};

export type ConflictContext = {
  repoPath: string;
  branch: string;
  target: string;
  operation: "rebase" | "merge";
};

export type WorktreeRemoveContext = {
  repoPath: string;
  worktreePath: string | null;
  branch: string;
  workspace: string;
  workspaceId: string;
  anchors?: HookResourceAnchor[];
  projectId: string;
};
