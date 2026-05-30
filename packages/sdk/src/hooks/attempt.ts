import type { BaseHookContext } from "./base";
import type { HookTicket, HookWorkspace } from "./entities";

/** @deprecated Legacy ticket attempt hook context. Workspace status automation is extension-owned. */
export type AttemptStatusChangeContext = BaseHookContext & {
  workspace: HookWorkspace;
  workspaceId: string;
  prompts: Record<string, string>;
  /** @deprecated Legacy ticket linkage. Ticket data is owned by the pstdio tickets extension. */
  ticket?: HookTicket;
  worktreePath?: string;
  branch?: string;
  fromStatus: string;
  toStatus: string;
  sessionId?: string;
  originalSessionId?: string;
};
