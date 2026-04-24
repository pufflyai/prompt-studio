import { describe, expect, it } from "bun:test";
import {
  buildQuestionAnswerValues,
  buildQuestionResponse,
  type ChatInputQuestionPrompt,
  getQuestionPromptSignature,
  hasMissingRequiredQuestionAnswer,
} from "./chat-input-question-prompt";

describe("chat input question helpers", () => {
  it("builds OpenCode answer values in question order", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "weather",
          question: "What's the weather like?",
          options: [{ label: "Hot" }, { label: "Nice" }],
        },
        {
          id: "notes",
          question: "Anything else?",
          options: [],
          allowCustomAnswer: true,
        },
      ],
    };

    expect(
      buildQuestionAnswerValues(
        prompt,
        {
          weather: ["Nice"],
        },
        { notes: "Light breeze" },
      ),
    ).toEqual([["Nice"], ["Light breeze"]]);
  });

  it("builds structured response for separate custom answers in a multi-step form", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "goal",
          question: "What should be built?",
          options: [],
          required: true,
          allowCustomAnswer: true,
        },
        {
          id: "constraints",
          question: "What constraints matter?",
          options: [],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(buildQuestionResponse(prompt, {}, { goal: "A CLI workflow", constraints: "Keep package APIs stable" })).toBe(
      ["What should be built?: A CLI workflow", "What constraints matter?: Keep package APIs stable"].join("\n"),
    );
  });

  it("requires each required custom-answer question to have its own answer", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "first",
          question: "First step?",
          options: [],
          required: true,
          allowCustomAnswer: true,
        },
        {
          id: "second",
          question: "Second step?",
          options: [],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(hasMissingRequiredQuestionAnswer(prompt, {}, { first: "Start here" })).toBe(true);
    expect(hasMissingRequiredQuestionAnswer(prompt, {}, { first: "Start here", second: "Then continue" })).toBe(false);
  });

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
        "Which language do you want to use?: Use Elixir for a prototype",
        "What should the plan prioritize?: Use Elixir for a prototype",
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
