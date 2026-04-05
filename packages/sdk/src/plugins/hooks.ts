import type { AttemptStatusChangeContext } from "../hooks/attempt";
import type { SessionHookContext } from "../hooks/session";
import type { TicketContext, TicketCreationContext, TicketStatusChangeContext } from "../hooks/ticket";
import type {
  CommitContext,
  ConflictContext,
  MergeContext,
  RebaseContext,
  WorktreeContext,
  WorktreeCreateContext,
  WorktreeRemoveContext,
} from "../hooks/worktree";

export type HookResponse = { reject?: boolean; reason?: string };
export type PreHookReturn = HookResponse | undefined | Promise<HookResponse | undefined>;
export type PostHookReturn = void | Promise<void>;

export type PluginHooks = {
  preTicketCreation?: (ctx: TicketCreationContext) => PreHookReturn;
  postTicketCreation?: (ctx: TicketContext) => PostHookReturn;
  preTicketStatusChange?: (ctx: TicketStatusChangeContext) => PreHookReturn;
  postTicketStatusChange?: (ctx: TicketStatusChangeContext) => PostHookReturn;
  preTicketArchive?: (ctx: TicketContext) => PreHookReturn;
  postTicketArchive?: (ctx: TicketContext) => PostHookReturn;
  preTicketDeletion?: (ctx: TicketContext) => PreHookReturn;
  postTicketDeletion?: (ctx: TicketContext) => PostHookReturn;
  postSessionStart?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionSuccess?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionFail?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionResume?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionAwaitInput?: (ctx: SessionHookContext) => PostHookReturn;
  preWorktreeCreate?: (ctx: WorktreeCreateContext) => PreHookReturn;
  postWorktreeCreate?: (ctx: WorktreeContext) => PostHookReturn;
  preWorktreeRemove?: (ctx: WorktreeRemoveContext) => PreHookReturn;
  postWorktreeRemove?: (ctx: WorktreeRemoveContext) => PostHookReturn;
  preCommit?: (ctx: CommitContext) => PreHookReturn;
  postCommit?: (ctx: CommitContext) => PostHookReturn;
  preRebase?: (ctx: RebaseContext) => PreHookReturn;
  postRebase?: (ctx: RebaseContext) => PostHookReturn;
  preMerge?: (ctx: MergeContext) => PreHookReturn;
  postMerge?: (ctx: MergeContext) => PostHookReturn;
  onConflict?: (ctx: ConflictContext) => PostHookReturn;
  preAttemptStatusChange?: (ctx: AttemptStatusChangeContext) => PreHookReturn;
  postAttemptStatusChange?: (ctx: AttemptStatusChangeContext) => PostHookReturn;
};
