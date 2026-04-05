import type { FollowUpInput } from "@pstdio/sdk/api";
import type { PstdioClient } from "@pstdio/sdk/client";

type HookSessionFollowupInput = Omit<FollowUpInput, "template" | "vars">;

type HookClient = PstdioClient & {
  session: {
    followup(input: HookSessionFollowupInput): ReturnType<PstdioClient["sessions"]["followUp"]>;
  };
};

const resolveFollowupSessionId = (context: Record<string, unknown>) => {
  const originalSessionId = context.originalSessionId;
  if (typeof originalSessionId === "string" && originalSessionId.length > 0) {
    return originalSessionId;
  }

  const sessionId = context.sessionId;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    return sessionId;
  }

  return null;
};

const stripTemplateAndVars = (input: HookSessionFollowupInput) => {
  const {
    template: _template,
    vars: _vars,
    ...safeInput
  } = input as HookSessionFollowupInput & {
    template?: string;
    vars?: Record<string, string>;
  };
  return safeInput;
};

export const withHookSessionClient = (client: PstdioClient, context: Record<string, unknown>): HookClient => ({
  ...client,
  session: {
    async followup(input) {
      const sessionId = resolveFollowupSessionId(context);
      if (!sessionId) {
        throw new Error("ctx.client.session.followup requires sessionId or originalSessionId in hook context");
      }

      return client.sessions.followUp(sessionId, stripTemplateAndVars(input));
    },
  },
});
