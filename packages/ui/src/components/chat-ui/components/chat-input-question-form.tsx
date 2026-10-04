import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { ChatInputAction } from "./chat-input-actions";
import {
  buildSkippedQuestionResponse,
  type ChatInputQuestionPrompt,
  type ChatInputQuestionResponse,
  QuestionPromptControls,
  SKIPPED_QUESTION_TEXT,
  toQuestionResponse,
} from "./chat-input-question-prompt";
import { ChatInputToolbar } from "./chat-input-toolbar";
import { useQuestionPromptState } from "./use-question-prompt-state";

interface ChatInputQuestionFormProps {
  prompt: ChatInputQuestionPrompt;
  actions?: ReactNode;
  disabled: boolean;
  onSubmit: (text: string, response: ChatInputQuestionResponse) => Promise<void>;
}

/** Key this form by request identity so async requests never share answer state. */
export const ChatInputQuestionForm = (props: ChatInputQuestionFormProps) => {
  const { prompt, actions, disabled, onSubmit } = props;
  const question = useQuestionPromptState(prompt);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const submit = async (skip = false) => {
    if (inFlight.current || disabled || (!skip && question.hasMissingRequiredAnswer)) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await onSubmit(
        skip ? SKIPPED_QUESTION_TEXT : question.responseText,
        skip ? buildSkippedQuestionResponse(prompt) : toQuestionResponse(prompt, question.buildAnswers()),
      );
      // Keep accepted replies locked until native history removes this request.
    } catch {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return (
    <>
      <QuestionPromptControls
        questionPrompt={prompt}
        selectedOptionsByQuestion={question.selectedOptionsByQuestion}
        customAnswersByQuestion={question.customAnswersByQuestion}
        onToggleOption={question.toggleOption}
        onToggleOther={question.toggleOther}
        onCustomAnswerChange={question.setCustomAnswer}
      />
      <ChatInputToolbar
        actions={actions}
        questionPrompt
        skipDisabled={disabled || submitting}
        skipTitle="Skip this question and let the agent continue"
        onSkip={() => void submit(true)}
        buttonAction={
          disabled || submitting || question.hasMissingRequiredAnswer || !question.responseText ? "none" : "submit"
        }
        messageTitle="Send answer"
        runAction={(action: ChatInputAction) => {
          if (action === "submit") void submit();
        }}
      />
    </>
  );
};
