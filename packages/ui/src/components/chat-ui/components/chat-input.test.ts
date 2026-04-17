import { describe, expect, it } from "bun:test";
import {
  buildQuestionResponse,
  type ChatInputQuestionPrompt,
  getQuestionPromptSignature,
  hasMissingRequiredQuestionAnswer,
} from "./chat-input";

describe("chat input question helpers", () => {
  it("supports required custom answer with text only", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(hasMissingRequiredQuestionAnswer(prompt, {}, "Custom language choice")).toBe(false);
  });

  it("flags required question when no selected option or custom text is present", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(hasMissingRequiredQuestionAnswer(prompt, {}, "   ")).toBe(true);
  });

  it("builds structured response for multi-question selections", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          multiple: false,
        },
        {
          id: "focus",
          question: "What should the plan prioritize?",
          options: [{ label: "Performance" }, { label: "Reliability" }],
          multiple: true,
        },
      ],
    };

    const response = buildQuestionResponse(
      prompt,
      {
        language: ["Python"],
        focus: ["Performance", "Reliability"],
      },
      "Keep API stable",
    );

    expect(response).toBe(
      [
        "Which language do you want to use?: Python",
        "What should the plan prioritize?: Performance, Reliability",
        "Additional response: Keep API stable",
      ].join("\n"),
    );
  });

  it("attributes custom text to each custom-answer question", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          allowCustomAnswer: true,
        },
        {
          id: "focus",
          question: "What should the plan prioritize?",
          options: [{ label: "Performance" }, { label: "Reliability" }],
          allowCustomAnswer: true,
        },
      ],
    };

    const response = buildQuestionResponse(prompt, {}, "Use Elixir for a prototype");

    expect(response).toBe(
      [
        "Which language do you want to use? (custom): Use Elixir for a prototype",
        "What should the plan prioritize? (custom): Use Elixir for a prototype",
      ].join("\n"),
    );
  });

  it("keeps the same prompt signature for equivalent prompt content", () => {
    const promptA: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };
    const promptB: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(getQuestionPromptSignature(promptA)).toBe(getQuestionPromptSignature(promptB));
  });

  it("changes the prompt signature when prompt content changes", () => {
    const promptA: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Python" }],
        },
      ],
    };
    const promptB: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "language",
          question: "Which language do you want to use?",
          options: [{ label: "TypeScript" }, { label: "Go" }],
        },
      ],
    };

    expect(getQuestionPromptSignature(promptA)).not.toBe(getQuestionPromptSignature(promptB));
  });
});
