import type { BaseHookContext } from "./base";
import type { HookTicket, HookWorkspace } from "./entities";

export type SessionHookContext = BaseHookContext & {
  sessionId: string;
  sessionStatus: "in_progress" | "awaiting_input" | "queued" | "completed" | "failed" | "cancelled" | "disconnected";
  originalSessionId?: string;
  workspace?: HookWorkspace;
  workspaceId?: string;
  worktreePath?: string;
  branch?: string;
  ticket?: HookTicket;
  attemptStatus?: string;
};
