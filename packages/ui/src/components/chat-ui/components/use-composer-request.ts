import { useState } from "react";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import type { ComposerDecision } from "./composer-decision";
import { type ComposerRequest, resolveComposerRequest } from "./composer-request";

export const useComposerRequest = (
  question: ChatInputQuestionPrompt | undefined,
  decision: ComposerDecision | undefined,
) => {
  const [active, setActive] = useState<ComposerRequest>();
  const request = resolveComposerRequest(question, decision, active);
  if (request?.kind !== active?.kind || request?.id !== active?.id) setActive(request);
  return request;
};
