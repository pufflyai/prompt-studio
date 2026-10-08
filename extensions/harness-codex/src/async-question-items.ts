import type { CodexThreadItem } from "./types";

export interface AsyncUserInputQuestion {
  title: string;
  options?: string[] | null;
}

export const asyncQuestionItem = (id: string, questions: AsyncUserInputQuestion[]): CodexThreadItem => ({
  id,
  type: "question",
  status: "pending",
  input: {
    delivery: "async",
    questions: questions.map((question, index) => ({
      id: `question-${index}`,
      question: question.title,
      options: (question.options ?? []).map((label) => ({ label })),
      allowCustomAnswer: true,
      required: true,
    })),
  },
});
