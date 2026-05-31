import type {
  AttemptStatusChangeContext,
  BaseHookContext,
  CommitContext,
  ConflictContext,
  HookClient,
  HookPayload,
  MergeContext,
  RebaseContext,
  SessionFollowupInput,
  SessionHookContext,
  TicketContext,
  TicketCreationContext,
  TicketStatusChangeContext,
  WorktreeContext,
  WorktreeCreateContext,
  WorktreeRemoveContext,
} from "./index";

const assertHookBarrelExports = (_exports: {
  attempt: AttemptStatusChangeContext;
  base: BaseHookContext;
  client: HookClient;
  payload: HookPayload;
  followup: SessionFollowupInput;
  session: SessionHookContext;
  ticket: TicketContext;
  ticketCreation: TicketCreationContext;
  ticketStatus: TicketStatusChangeContext;
  worktree: WorktreeContext;
  worktreeCreate: WorktreeCreateContext;
  worktreeRemove: WorktreeRemoveContext;
  commit: CommitContext;
  rebase: RebaseContext;
  merge: MergeContext;
  conflict: ConflictContext;
}) => {};

void assertHookBarrelExports;
