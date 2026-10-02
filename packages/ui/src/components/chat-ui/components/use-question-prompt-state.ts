import { useEffect, useRef, useState } from "react";
import {
  buildQuestionAnswerValues,
  buildQuestionResponse,
  type ChatInputQuestion,
  type ChatInputQuestionCustomAnswers,
  type ChatInputQuestionPrompt,
  clearQuestionOtherAnswer,
  getQuestionPromptSignature,
  getQuestionSelectionKey,
  hasMissingRequiredQuestionAnswer,
  toggleQuestionOptionSelection,
  toggleQuestionOtherAnswer,
} from "./chat-input-question-prompt";

/**
 * Holds what the person picked for the open question and derives what the form would send.
 * `resetToken` clears the picks whenever the composer itself is reset, such as a new draft.
 */
export const useQuestionPromptState = (questionPrompt: ChatInputQuestionPrompt | undefined, resetToken?: unknown) => {
  const [selectedOptionsByQuestion, setSelectedOptionsByQuestion] = useState<Record<string, string[]>>({});
  const [customAnswersByQuestion, setCustomAnswersByQuestion] = useState<ChatInputQuestionCustomAnswers>({});
  const signature = getQuestionPromptSignature(questionPrompt);
  const previousResetRef = useRef(JSON.stringify([signature, resetToken ?? null]));

  const reset = () => {
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
  };

  useEffect(() => {
    const current = JSON.stringify([signature, resetToken ?? null]);
    if (previousResetRef.current === current) return;
    previousResetRef.current = current;
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
  }, [signature, resetToken]);

  const toggleOption = (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => {
    setSelectedOptionsByQuestion((current) =>
      toggleQuestionOptionSelection(current, question, questionIndex, optionLabel),
    );
    // A listed choice replaces Other on a single-choice question.
    if (!question.multiple) {
      setCustomAnswersByQuestion((current) => clearQuestionOtherAnswer(current, question, questionIndex));
    }
  };

  const toggleOther = (question: ChatInputQuestion, questionIndex: number) => {
    setCustomAnswersByQuestion((current) => toggleQuestionOtherAnswer(current, question, questionIndex));
    // Other replaces the listed choice on a single-choice question.
    if (!question.multiple) {
      setSelectedOptionsByQuestion((current) => ({
        ...current,
        [getQuestionSelectionKey(question, questionIndex)]: [],
      }));
    }
  };

  const setCustomAnswer = (question: ChatInputQuestion, questionIndex: number, answer: string) => {
    const key = getQuestionSelectionKey(question, questionIndex);
    setCustomAnswersByQuestion((current) => ({ ...current, [key]: answer }));
  };

  return {
    signature,
    selectedOptionsByQuestion,
    customAnswersByQuestion,
    reset,
    toggleOption,
    toggleOther,
    setCustomAnswer,
    responseText: questionPrompt
      ? buildQuestionResponse(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion)
      : "",
    hasMissingRequiredAnswer: hasMissingRequiredQuestionAnswer(
      questionPrompt,
      selectedOptionsByQuestion,
      customAnswersByQuestion,
    ),
    buildAnswers: () =>
      questionPrompt
        ? buildQuestionAnswerValues(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion)
        : [],
  };
};
