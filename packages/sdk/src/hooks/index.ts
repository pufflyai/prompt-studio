/** @deprecated Use typed hooks from `@pstdio/sdk/extensions`. This host-only entry is removed in 0.45. */
export type { BaseHookContext, HookClient, HookPayload, SessionFollowupInput } from "./base";
export type { SessionHookContext } from "./session";
export type {
  CommitContext,
  ConflictContext,
  MergeContext,
  RebaseContext,
  WorktreeContext,
  WorktreeCreateContext,
  WorktreeRemoveContext,
} from "./worktree";
