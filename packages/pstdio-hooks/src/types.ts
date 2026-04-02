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

export type AttemptStatusHookName =
  | "pre-attempt-status"
  | "post-attempt-status"
  | `pre-attempt-status-${string}`
  | `post-attempt-status-${string}`;

export type HookName = WorktreeHookName | SessionHookName | TicketHookName | AttemptStatusHookName;

export type HookPayload = Record<string, unknown>;

export type RunHookOptions = {
  repoPath: string;
  cwd?: string;
  timeoutMs?: number;
};

export type HookResult = {
  hook: HookName;
  skipped: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
};
