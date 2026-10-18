import type { FollowUpInput } from "../api/sessions";
import type { PstdioClient } from "../client";
import type { Session } from "../resources";

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type SessionFollowupInput = Omit<FollowUpInput, "template" | "vars">;

type HookSessionClient = {
  /** @deprecated Use `client.sessions.followUp(sessionId, input)` from `@pstdio/sdk/client`. */
  followup(input: SessionFollowupInput): Promise<Session>;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type HookClient = PstdioClient & {
  /** @deprecated Use the plural `sessions` client. */
  session: HookSessionClient;
};

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type HookPayload = Record<string, unknown>;

/** @deprecated Use typed extension hook contexts from `@pstdio/sdk/extensions`. Removed in 0.45. */
export type BaseHookContext = {
  client: HookClient;
  projectId: string;
  /** @deprecated Use the typed extension hook context directly; the raw payload mirror is removed in 0.45. */
  payload?: HookPayload;
};
