import { composeSummary } from "./compose-summary";
import type { SessionsRouteDeps } from "./deps";
import { getSessionMessages } from "./get-session-messages";

export const buildFollowUpPrompt = async (
  input: {
    prompt?: string;
    summary_from_session_id?: string;
    summary_format?: "brief" | "detailed";
    summary_role?: "assistant" | "all";
  },
  deps: SessionsRouteDeps,
) => {
  let prompt = input.prompt ?? "";
  if (input.summary_from_session_id) {
    const messages = await getSessionMessages(input.summary_from_session_id, deps);
    const summary = composeSummary(messages, {
      format: input.summary_format ?? "brief",
      role: input.summary_role ?? "assistant",
    });
    if (summary) {
      const block = `<session-summary>\n${summary}\n</session-summary>`;
      prompt = prompt ? `${prompt}\n\n${block}` : block;
    }
  }
  return prompt;
};
