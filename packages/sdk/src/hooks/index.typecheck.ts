import type {
  BaseHookContext,
  CommitContext,
  ConflictContext,
  HookClient,
  HookPayload,
  MergeContext,
  RebaseContext,
  SessionFollowupInput,
  SessionHookContext,
  WorktreeContext,
  WorktreeCreateContext,
  WorktreeRemoveContext,
} from "./index";

const assertHookBarrelExports = (_exports: {
  base: BaseHookContext;
  client: HookClient;
  payload: HookPayload;
  followup: SessionFollowupInput;
  session: SessionHookContext;
  worktree: WorktreeContext;
  worktreeCreate: WorktreeCreateContext;
  worktreeRemove: WorktreeRemoveContext;
  commit: CommitContext;
  rebase: RebaseContext;
  merge: MergeContext;
  conflict: ConflictContext;
}) => {};

void assertHookBarrelExports;
