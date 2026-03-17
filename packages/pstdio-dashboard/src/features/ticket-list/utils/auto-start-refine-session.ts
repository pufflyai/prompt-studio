import { buildRefineTicketPrompt } from "../../ticket/utils/build-prompts";

interface AutoStartRefineSessionInput {
  ticketShorthand: string;
  templateName: string | null;
  startSession: (prompt: string) => Promise<string | null>;
  openSessionBubble: (sessionId: string | null) => boolean;
}

export const autoStartRefineSession = async (input: AutoStartRefineSessionInput) => {
  const { ticketShorthand, templateName, startSession, openSessionBubble } = input;
  const template = templateName?.trim();

  if (!template) {
    return false;
  }

  const sessionId = await startSession(buildRefineTicketPrompt(ticketShorthand, "", template));
  return openSessionBubble(sessionId);
};
