import { expect, test } from "bun:test";
import type { ReviewQuestion } from "../../data/review-request-types";
import { toQuestionPrompt, toResponseAnswers, toSavedPromptState } from "./review-question-prompt";

test("the shared form preserves distinct choice IDs when labels repeat", () => {
  const questions: ReviewQuestion[] = [
    {
      id: "scope",
      label: "Choose",
      required: true,
      input: {
        kind: "single-choice",
        options: [
          { id: "a", label: "Same" },
          { id: "b", label: "Same" },
        ],
      },
    },
    {
      id: "platforms",
      label: "Select",
      required: false,
      input: {
        kind: "multiple-choice",
        options: [
          { id: "x", label: "Same" },
          { id: "y", label: "Same" },
        ],
      },
    },
    { id: "notes", label: "Notes", required: false, input: { kind: "text" } },
  ];
  const prompt = toQuestionPrompt("request-1", questions);
  const labels = prompt.questions[0].options.map(({ label }) => label);
  expect(new Set(labels).size).toBe(2);
  expect(
    toResponseAnswers(questions, [[labels[1]], prompt.questions[1].options.map(({ label }) => label), ["Keep both"]]),
  ).toEqual({ scope: "b", platforms: ["x", "y"], notes: "Keep both" });
  expect(toQuestionPrompt("request-2", questions).questions[0].id).not.toBe(prompt.questions[0].id);
  expect(
    toSavedPromptState("request-1", questions, { answers: { scope: "b", platforms: ["x", "y"], notes: "Keep both" } }),
  ).toEqual({
    selected: { "request-1:scope": ["2. Same"], "request-1:platforms": ["1. Same", "2. Same"] },
    custom: { "request-1:notes": "Keep both" },
  });
});
