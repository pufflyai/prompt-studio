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
  it("promotes an unanswered OpenCode question into the chat input", () => {
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

  it("keeps the first async question active when another request arrives", () => {
    const first = openCodeQuestionMessages({ input: { questions: [{ question: "First?", options: ["Yes"] }] } });
    first[1].parts[0] = { ...first[1].parts[0], callId: "first" };
    const second: SessionMessage = {
      id: "second",
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: "question",
          callId: "second",
          status: "running",
          state: { input: { questions: [{ question: "Second?", options: ["No"] }] } },
        },
      ],
    };
    expect(resolveActiveQuestionPrompt([...first, second])?.callId).toBe("first");
    first[1].parts[0] = { ...first[1].parts[0], state: { metadata: { answers: [["Yes"]] } } };
    expect(resolveActiveQuestionPrompt([...first, second])?.callId).toBe("second");
  });

  it("does not let a later answered question hide an earlier pending request", () => {
    const first = openCodeQuestionMessages({ input: { questions: [{ question: "First?", options: ["Yes"] }] } });
    expect(
      resolveActiveQuestionPrompt([...first, ...openCodeQuestionMessages({ metadata: { answers: [["No"]] } })])
        ?.questions[0].question,
    ).toBe("First?");
  });

  it("advances past a withdrawn question", () => {
    const messages = openCodeQuestionMessages({ input: { questions: [{ question: "Withdrawn?", options: [] }] } });
    messages[1].parts[0] = { ...messages[1].parts[0], status: "denied" };
    expect(resolveActiveQuestionPrompt(messages)).toBeUndefined();
  });

  it("uses the latest native state for repeated request identities", () => {
    const request: SessionMessage = {
      id: "first",
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: "question",
          callId: "same-request",
          status: "running",
          state: { input: { questions: [{ question: "First?", options: ["Yes"] }] } },
        },
      ],
    };
    const answered: SessionMessage = {
      id: "updated",
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: "question",
          callId: "same-request",
          status: "completed",
          state: { metadata: { answers: [["Yes"]] } },
        },
      ],
    };
    expect(resolveActiveQuestionPrompt([request, answered])).toBeUndefined();
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
