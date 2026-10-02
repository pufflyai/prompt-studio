import { getOwnQuestionValue } from "./question-choices";

export interface ChatInputQuestionOption {
  label: string;
  description?: string;
}

export interface ChatInputQuestion {
  id?: string;
  question: string;
  options: ChatInputQuestionOption[];
  multiple?: boolean;
  required?: boolean;
  allowCustomAnswer?: boolean;
}

export interface ChatInputQuestionPrompt {
  questions: ChatInputQuestion[];
  callId?: string;
}

export interface ChatInputQuestionResponse {
  answers: string[][];
  callId?: string;
}

export type ChatInputQuestionCustomAnswers = Record<string, string>;

export const getQuestionSelectionKey = (question: ChatInputQuestion, index: number) =>
  question.id ?? `question-${index}`;

// "Other" is chosen exactly when the question holds a custom answer, empty or not. That keeps
// the choice and its text in one place instead of a second map that can disagree with it.
export const isQuestionOtherSelected = (
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
  question: ChatInputQuestion,
  questionIndex: number,
  // Question ids come from the agent, so `in` would match inherited keys such as "constructor".
) => Object.hasOwn(customAnswersByQuestion, getQuestionSelectionKey(question, questionIndex));

export const clearQuestionOtherAnswer = (
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
  question: ChatInputQuestion,
  questionIndex: number,
) => {
  const { [getQuestionSelectionKey(question, questionIndex)]: _removed, ...rest } = customAnswersByQuestion;
  return rest;
};

export const toggleQuestionOtherAnswer = (
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
  question: ChatInputQuestion,
  questionIndex: number,
) => {
  if (isQuestionOtherSelected(customAnswersByQuestion, question, questionIndex)) {
    return clearQuestionOtherAnswer(customAnswersByQuestion, question, questionIndex);
  }
  return { ...customAnswersByQuestion, [getQuestionSelectionKey(question, questionIndex)]: "" };
};

/** Shown in the chat so the transcript records that the person chose not to answer. */
export const SKIPPED_QUESTION_TEXT = "Skipped the question.";

// The call id names the live request the prompt came from, so a reply can never reach a newer
// request that asks the same question.
export const toQuestionResponse = (
  questionPrompt: ChatInputQuestionPrompt,
  answers: string[][],
): ChatInputQuestionResponse => (questionPrompt.callId ? { answers, callId: questionPrompt.callId } : { answers });

/** A skipped question carries no entry at all, which no answered form ever produces. */
export const buildSkippedQuestionResponse = (questionPrompt: ChatInputQuestionPrompt) =>
  toQuestionResponse(questionPrompt, []);

// Single-choice questions swap the answer; multiple-choice questions toggle one option.
export const toggleQuestionOptionSelection = (
  selectedOptionsByQuestion: Record<string, string[]>,
  question: ChatInputQuestion,
  questionIndex: number,
  optionLabel: string,
) => {
  const key = getQuestionSelectionKey(question, questionIndex);
  const selected = getOwnQuestionValue(selectedOptionsByQuestion, key) ?? [];
  const alreadySelected = selected.includes(optionLabel);
  if (question.multiple) {
    return {
      ...selectedOptionsByQuestion,
      [key]: alreadySelected ? selected.filter((label) => label !== optionLabel) : [...selected, optionLabel],
    };
  }
  return { ...selectedOptionsByQuestion, [key]: alreadySelected ? [] : [optionLabel] };
};

export const getQuestionPromptSignature = (questionPrompt: ChatInputQuestionPrompt | undefined) => {
  if (!questionPrompt) return "";

  return JSON.stringify({
    callId: questionPrompt.callId,
    questions: questionPrompt.questions.map((question, index) => ({
      id: getQuestionSelectionKey(question, index),
      question: question.question,
      multiple: Boolean(question.multiple),
      required: Boolean(question.required),
      allowCustomAnswer: Boolean(question.allowCustomAnswer),
      options: question.options.map((option) => ({
        label: option.label,
        description: option.description ?? "",
      })),
    })),
  });
};

// A single-choice question answers with one value: the typed text replaces the listed option it
// was chosen instead of. A multiple-choice question keeps the typed text beside its checked boxes.
export const answersForQuestion = (
  question: ChatInputQuestion,
  selectedLabels: string[],
  customAnswer: string | undefined,
) => {
  const typed = customAnswer?.trim();
  if (!typed) return selectedLabels;
  return question.multiple ? [...selectedLabels, typed] : [typed];
};

export const getAnswersForQuestion = (
  question: ChatInputQuestion,
  key: string,
  selectedOptionsByQuestion: Record<string, string[]>,
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
) =>
  answersForQuestion(
    question,
    getOwnQuestionValue(selectedOptionsByQuestion, key) ?? [],
    getOwnQuestionValue(customAnswersByQuestion, key),
  );

const getQuestionAnswerLines = (
  questionPrompt: ChatInputQuestionPrompt,
  selectedOptionsByQuestion: Record<string, string[]>,
  customAnswersByQuestion: ChatInputQuestionCustomAnswers,
) => {
  const lines: string[] = [];

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    const key = getQuestionSelectionKey(question, index);
    const answers = getAnswersForQuestion(question, key, selectedOptionsByQuestion, customAnswersByQuestion);
    if (answers.length === 0) continue;

    lines.push(`${question.question}: ${answers.join(", ")}`);
  }

  return lines;
};

const isCustomAnswersByQuestion = (
  value: ChatInputQuestionCustomAnswers | string,
): value is ChatInputQuestionCustomAnswers => typeof value !== "string";

const toCustomAnswersByQuestion = (
  questionPrompt: ChatInputQuestionPrompt,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (isCustomAnswersByQuestion(answerInput)) return answerInput;

  const trimmed = answerInput.trim();
  if (trimmed.length === 0) return {};

  return Object.fromEntries(
    questionPrompt.questions.flatMap((question, index) =>
      question.allowCustomAnswer ? [[getQuestionSelectionKey(question, index), trimmed]] : [],
    ),
  );
};

export const buildQuestionResponse = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (!questionPrompt) return typeof answerInput === "string" ? answerInput.trim() : "";

  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);
  const lines = getQuestionAnswerLines(questionPrompt, selectedOptionsByQuestion, customAnswersByQuestion);
  const legacyText = typeof answerInput === "string" ? answerInput.trim() : "";
  const hasCustomQuestions = questionPrompt.questions.some((question) => question.allowCustomAnswer);

  if (legacyText.length > 0 && !hasCustomQuestions) {
    lines.push(`Additional response: ${legacyText}`);
  }

  return lines.join("\n");
};

export const buildQuestionAnswerValues = (
  questionPrompt: ChatInputQuestionPrompt,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);

  return questionPrompt.questions.map((question, index) => {
    const key = getQuestionSelectionKey(question, index);
    return getAnswersForQuestion(question, key, selectedOptionsByQuestion, customAnswersByQuestion);
  });
};

export const hasMissingRequiredQuestionAnswer = (
  questionPrompt: ChatInputQuestionPrompt | undefined,
  selectedOptionsByQuestion: Record<string, string[]>,
  answerInput: ChatInputQuestionCustomAnswers | string,
) => {
  if (!questionPrompt) return false;

  const customAnswersByQuestion = toCustomAnswersByQuestion(questionPrompt, answerInput);

  for (let index = 0; index < questionPrompt.questions.length; index += 1) {
    const question = questionPrompt.questions[index];
    if (!question.required) continue;

    const key = getQuestionSelectionKey(question, index);
    // One rule decides what a question answers with, so the send guard cannot drift from it.
    if (getAnswersForQuestion(question, key, selectedOptionsByQuestion, customAnswersByQuestion).length > 0) continue;

    return true;
  }

  return false;
};
