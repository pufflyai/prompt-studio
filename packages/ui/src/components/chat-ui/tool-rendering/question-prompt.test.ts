import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "../components/message-types";
import { resolveActiveQuestionPrompt } from "./question-prompt";

const openCodeQuestionMessages = (questionState: Record<string, unknown>): SessionMessage[] => [
  {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "Create a notification" }],
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "question",
        status: "running",
        state: questionState,
      },
    ],
  },
  {
    id: "user-2",
    role: "user",
    parts: [{ type: "text", text: "hi" }],
  },
];

describe("resolveActiveQuestionPrompt", () => {
  it("promotes the latest unanswered OpenCode question into the chat input", () => {
    const prompt = resolveActiveQuestionPrompt(
      openCodeQuestionMessages({
        status: "running",
        input: {
          questions: [
            {
              question: "Which project should the notification be created for?",
              options: [{ label: "Prompt Studio", description: "The current project" }],
            },
            {
              question: "What is the notification title?",
              options: [],
            },
          ],
        },
      }),
    );

    expect(prompt).toEqual({
      questions: [
        {
          id: "question-0",
          question: "Which project should the notification be created for?",
          options: [{ label: "Prompt Studio", description: "The current project" }],
          multiple: false,
          required: true,
          allowCustomAnswer: false,
        },
        {
          id: "question-1",
          question: "What is the notification title?",
          options: [],
          multiple: false,
          required: true,
          allowCustomAnswer: true,
        },
      ],
    });
  });

  it("does not promote a question after OpenCode stores submitted answers", () => {
    const prompt = resolveActiveQuestionPrompt(
      openCodeQuestionMessages({
        status: "completed",
        input: {
          questions: [
            {
              question: "Which project?",
              options: ["Prompt Studio"],
            },
          ],
        },
        metadata: { answers: [["Prompt Studio"]] },
      }),
    );

    expect(prompt).toBeUndefined();
  });
});
