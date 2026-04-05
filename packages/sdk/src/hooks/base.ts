import type { FollowUpInput } from "../api/sessions";
import type { PstdioClient } from "../client";
import type { Session } from "../resources";

export type SessionFollowupInput = Omit<FollowUpInput, "template" | "vars">;

type HookSessionClient = {
  followup(input: SessionFollowupInput): Promise<Session>;
};

export type HookClient = PstdioClient & {
  session: HookSessionClient;
};

export type HookPayload = Record<string, unknown>;

export type BaseHookContext = {
  client: HookClient;
  projectId: string;
  // Raw hook payload mirror for compatibility/migration from filesystem hooks.
  payload?: HookPayload;
};
