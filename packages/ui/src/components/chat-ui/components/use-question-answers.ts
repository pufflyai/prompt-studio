import { useEffect, useRef, useState } from "react";
import {
  type ChatInputQuestion,
  type ChatInputQuestionCustomAnswers,
  type ChatInputQuestionPrompt,
  getQuestionPromptSignature,
  getQuestionSelectionKey,
  toggleQuestionOptionSelection,
} from "./chat-input-question-prompt";

export const useQuestionAnswers = (questionPrompt: ChatInputQuestionPrompt | undefined, defaultState: string) => {
  const [selectedOptionsByQuestion, setSelectedOptionsByQuestion] = useState<Record<string, string[]>>({});
  const [customAnswersByQuestion, setCustomAnswersByQuestion] = useState<ChatInputQuestionCustomAnswers>({});
  const signature = getQuestionPromptSignature(questionPrompt);
  const resetKey = JSON.stringify([defaultState, signature]);
  const previousResetKey = useRef(resetKey);

  useEffect(() => {
    if (previousResetKey.current === resetKey) return;
    previousResetKey.current = resetKey;
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
  }, [resetKey]);

  const reset = () => {
    setSelectedOptionsByQuestion({});
    setCustomAnswersByQuestion({});
  };

  const toggleOption = (question: ChatInputQuestion, questionIndex: number, optionLabel: string) => {
    setSelectedOptionsByQuestion((current) =>
      toggleQuestionOptionSelection(current, question, questionIndex, optionLabel),
    );
    if (question.multiple) return;
    const key = getQuestionSelectionKey(question, questionIndex);
    setCustomAnswersByQuestion((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const changeCustomAnswer = (question: ChatInputQuestion, questionIndex: number, answer: string) => {
    const key = getQuestionSelectionKey(question, questionIndex);
    setCustomAnswersByQuestion((current) => ({ ...current, [key]: answer }));
    if (question.multiple) return;
    setSelectedOptionsByQuestion((current) => ({ ...current, [key]: [] }));
  };

  return { selectedOptionsByQuestion, customAnswersByQuestion, signature, reset, toggleOption, changeCustomAnswer };
};
