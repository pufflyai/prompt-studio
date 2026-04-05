import type { FollowUpInput } from "../../api/sessions";
import { type PluginHelperContext, resolveSessionIdFromContext } from "./context";

type FollowupSessionHelperInput = FollowUpInput & {
  sessionId?: string;
};

export const followupSession = async (ctx: PluginHelperContext, input: FollowupSessionHelperInput) => {
  const sessionId = input.sessionId ?? resolveSessionIdFromContext(ctx);
  if (!sessionId) {
    throw new Error("followupSession requires sessionId or hook/action session context");
  }

  const { sessionId: _sessionId, ...followupInput } = input;
  return ctx.client.sessions.followUp(sessionId, followupInput);
};
