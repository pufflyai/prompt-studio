import type { ReactNode } from "react";
import { ChatInputQuestionForm } from "./chat-input-question-form";
import {
  type ChatInputQuestionPrompt,
  type ChatInputQuestionResponse,
  getQuestionPromptSignature,
} from "./chat-input-question-prompt";
import type { ComposerDecision } from "./composer-decision";
import { ComposerDecisionToolbar } from "./composer-decision-toolbar";
import type { ComposerRequest } from "./composer-request";

interface ComposerTakeoverProps {
  request?: ComposerRequest;
  question?: ChatInputQuestionPrompt;
  decision?: ComposerDecision;
  actions?: ReactNode;
  disabled: boolean;
  submitDisabled: boolean;
  onSubmit: (answer: string, response: ChatInputQuestionResponse) => Promise<void>;
}
export const ComposerTakeover = (props: ComposerTakeoverProps) => {
  const { request, question, decision, actions, disabled, submitDisabled, onSubmit } = props;
  if (request?.kind === "decision" && decision)
    return <ComposerDecisionToolbar key={decision.id} decision={decision} disabled={disabled} />;
  if (request?.kind === "question" && question)
    return (
      <ChatInputQuestionForm
        key={getQuestionPromptSignature(question)}
        prompt={question}
        actions={actions}
        disabled={disabled || submitDisabled}
        onSubmit={onSubmit}
      />
    );
  return null;
};
