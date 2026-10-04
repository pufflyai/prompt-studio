import { type ChatInputQuestionPrompt, getQuestionPromptSignature } from "./chat-input-question-prompt";
import type { ComposerDecision } from "./composer-decision";

export interface ComposerRequest {
  kind: "question" | "decision";
  id: string;
}

export const resolveComposerRequest = (
  question: ChatInputQuestionPrompt | undefined,
  decision: Pick<ComposerDecision, "id"> | undefined,
  active: ComposerRequest | undefined,
) => {
  const waiting: ComposerRequest[] = [];
  if (question) waiting.push({ kind: "question", id: question.callId ?? getQuestionPromptSignature(question) });
  if (decision) waiting.push({ kind: "decision", id: decision.id });
  return waiting.find((request) => request.kind === active?.kind && request.id === active.id) ?? waiting[0];
};
