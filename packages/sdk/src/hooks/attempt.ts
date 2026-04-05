import type { BaseHookContext } from "./base";
import type { HookTicket, HookWorkspace } from "./entities";

export type AttemptStatusChangeContext = BaseHookContext & {
  workspace: HookWorkspace;
  workspaceId: string;
  prompts: Record<string, string>;
  ticket?: HookTicket;
  worktreePath?: string;
  branch?: string;
  fromStatus: string;
  toStatus: string;
  sessionId?: string;
  originalSessionId?: string;
};
