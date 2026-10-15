import type { ChatInputQuestionPrompt } from "@pstdio/ui/chat-ui";
import type { ReviewQuestion } from "../../data/review-request-types";

// Number choices so repeated labels remain distinct both to the person and to the shared form.
const choices = (question: ReviewQuestion) =>
  question.input.kind === "text"
    ? []
    : question.input.options.map((option, index) => ({ ...option, label: `${index + 1}. ${option.label}` }));

export const toQuestionPrompt = (requestId: string, questions: ReviewQuestion[]) =>
  ({
    questions: questions.map((question) => ({
      id: `${requestId}:${question.id}`,
      question: question.label,
      required: question.required,
      multiple: question.input.kind === "multiple-choice",
      allowCustomAnswer: question.input.kind === "text",
      options: choices(question).map(({ label }) => ({ label })),
    })),
  }) satisfies ChatInputQuestionPrompt;

export const toResponseAnswers = (questions: ReviewQuestion[], answers: string[][]) =>
  Object.fromEntries(
    questions.flatMap((question, index) => {
      const values = answers[index] ?? [];
      if (values.length === 0) return [];
      if (question.input.kind === "text") return [[question.id, values[0]]];
      const options = choices(question);
      const ids = values.map((label) => options.find((option) => option.label === label)?.id ?? label);
      return [[question.id, question.input.kind === "multiple-choice" ? ids : ids[0]]];
    }),
  );
