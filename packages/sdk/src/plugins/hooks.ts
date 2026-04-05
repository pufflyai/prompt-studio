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

export type HookResponse = { reject?: boolean; reason?: string; data?: Record<string, unknown> };
export type PreHookReturn = HookResponse | undefined | Promise<HookResponse | undefined>;
export type PostHookReturn = void | Promise<void>;

export type PrePluginHooks = {
  preTicketCreation?: (ctx: TicketCreationContext) => PreHookReturn;
  preTicketStatusChange?: (ctx: TicketStatusChangeContext) => PreHookReturn;
  preTicketArchive?: (ctx: TicketContext) => PreHookReturn;
  preTicketDeletion?: (ctx: TicketContext) => PreHookReturn;
  preWorktreeCreate?: (ctx: WorktreeCreateContext) => PreHookReturn;
  preWorktreeRemove?: (ctx: WorktreeRemoveContext) => PreHookReturn;
  preCommit?: (ctx: CommitContext) => PreHookReturn;
  preRebase?: (ctx: RebaseContext) => PreHookReturn;
  preMerge?: (ctx: MergeContext) => PreHookReturn;
  preAttemptStatusChange?: (ctx: AttemptStatusChangeContext) => PreHookReturn;
};

export type PostPluginHooks = {
  postTicketCreation?: (ctx: TicketContext) => PostHookReturn;
  postTicketStatusChange?: (ctx: TicketStatusChangeContext) => PostHookReturn;
  postTicketArchive?: (ctx: TicketContext) => PostHookReturn;
  postTicketDeletion?: (ctx: TicketContext) => PostHookReturn;
  postSessionStart?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionSuccess?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionFail?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionResume?: (ctx: SessionHookContext) => PostHookReturn;
  postSessionAwaitInput?: (ctx: SessionHookContext) => PostHookReturn;
  postWorktreeCreate?: (ctx: WorktreeContext) => PostHookReturn;
  postWorktreeRemove?: (ctx: WorktreeRemoveContext) => PostHookReturn;
  postCommit?: (ctx: CommitContext) => PostHookReturn;
  postRebase?: (ctx: RebaseContext) => PostHookReturn;
  postMerge?: (ctx: MergeContext) => PostHookReturn;
  onConflict?: (ctx: ConflictContext) => PostHookReturn;
  postAttemptStatusChange?: (ctx: AttemptStatusChangeContext) => PostHookReturn;
};

export type PluginHooks = PrePluginHooks & PostPluginHooks;
