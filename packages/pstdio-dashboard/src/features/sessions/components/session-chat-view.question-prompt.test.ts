import { describe, expect, it } from "bun:test";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { getActiveQuestionPrompt } from "./session-chat-view.utils";

const message = (id: string, parts: SessionMessage["parts"]): SessionMessage => ({
  id,
  role: "assistant",
  parts,
});

describe("getActiveQuestionPrompt variants", () => {
  it("supports multi-choice and custom-answer payloads", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "framework",
                  question: "Choose frameworks",
                  options: [
                    { label: "React", description: "UI" },
                    { label: "Vue", description: "UI" },
                  ],
                  multiple: true,
                  custom: true,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "framework",
          question: "Choose frameworks",
          options: [
            { label: "React", description: "UI" },
            { label: "Vue", description: "UI" },
          ],
          multiple: true,
          required: false,
          allowCustomAnswer: true,
        },
      ],
    });
  });

  it("supports OpenCode multi_choice question type", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "outputs",
                  type: "multi_choice",
                  question: "Select outputs",
                  options: ["CLI command", "Unit tests"],
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)?.questions[0]?.multiple).toBe(true);
  });

  it("supports freeform question type without options", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "details",
                  type: "freeform",
                  question: "What should I know?",
                  required: true,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "details",
          question: "What should I know?",
          options: [],
          multiple: false,
          required: true,
          allowCustomAnswer: true,
        },
      ],
    });
  });

  it("falls back to the latest usable question payload when a newer one is malformed", () => {
    const messages: SessionMessage[] = [
      message("assistant-1", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "valid",
                  question: "Choose one",
                  options: [{ label: "A" }, { label: "B" }],
                  multiple: false,
                },
              ],
            },
          },
        },
      ]),
      message("assistant-2", [
        {
          type: "tool",
          tool: "question",
          state: {
            input: {
              questions: [
                {
                  id: "broken",
                  question: "Broken question",
                  options: [],
                  multiple: false,
                },
              ],
            },
          },
        },
      ]),
    ];

    expect(getActiveQuestionPrompt(messages)).toEqual({
      questions: [
        {
          id: "valid",
          question: "Choose one",
          options: [
            { label: "A", description: undefined },
            { label: "B", description: undefined },
          ],
          multiple: false,
          required: false,
          allowCustomAnswer: false,
        },
      ],
    });
  });
});
