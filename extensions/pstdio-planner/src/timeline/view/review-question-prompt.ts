import type { ChatInputQuestionPrompt } from "@pstdio/ui/chat-ui";
import type { ReviewQuestion, ReviewResponse } from "../../data/review-request-types";

const questionKey = (requestId: string, question: ReviewQuestion) => `${requestId}:${question.id}`;

// Number choices so repeated labels remain distinct both to the person and to the shared form.
const choices = (question: ReviewQuestion) =>
  question.input.kind === "text"
    ? []
    : question.input.options.map((option, index) => ({ ...option, label: `${index + 1}. ${option.label}` }));

export const toQuestionPrompt = (requestId: string, questions: ReviewQuestion[]) =>
  ({
    questions: questions.map((question) => ({
      id: questionKey(requestId, question),
      question: question.label,
      required: question.required,
      multiple: question.input.kind === "multiple-choice",
      allowCustomAnswer: question.input.kind === "text",
      options: choices(question).map(({ label }) => ({ label })),
    })),
  }) satisfies ChatInputQuestionPrompt;

export const toSavedPromptState = (requestId: string, questions: ReviewQuestion[], response?: ReviewResponse) => {
  const selected: Record<string, string[]> = {};
  const custom: Record<string, string> = {};
  if (!response || !("answers" in response)) return { selected, custom };
  for (const question of questions) {
    const answer = response.answers[question.id];
    if (answer === undefined) continue;
    const key = questionKey(requestId, question);
    if (question.input.kind === "text") custom[key] = String(answer);
    else {
      const ids = Array.isArray(answer) ? answer : [answer];
      selected[key] = choices(question)
        .filter(({ id }) => ids.includes(id))
        .map(({ label }) => label);
    }
  }
  return { selected, custom };
};

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
