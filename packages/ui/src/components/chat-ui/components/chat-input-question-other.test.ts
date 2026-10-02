import { describe, expect, it } from "bun:test";
import {
  buildQuestionAnswerValues,
  buildQuestionResponse,
  buildSkippedQuestionResponse,
  type ChatInputQuestionPrompt,
  clearQuestionOtherAnswer,
  getQuestionSelectionKey,
  hasMissingRequiredQuestionAnswer,
  isQuestionOtherSelected,
  toggleQuestionOptionSelection,
  toggleQuestionOtherAnswer,
} from "./chat-input-question-prompt";

describe("question Other choice and skip", () => {
  it.each(["constructor", "__proto__", "toString"])("answers a question whose id is %s", (id) => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [{ id, question: "Choose", options: [{ label: "Yes" }], required: true, allowCustomAnswer: true }],
    };
    expect(buildQuestionAnswerValues(prompt, {}, {})).toEqual([[]]);
    expect(hasMissingRequiredQuestionAnswer(prompt, {}, {})).toBe(true);
    const selected = toggleQuestionOptionSelection({}, prompt.questions[0], 0, "Yes");
    expect(buildQuestionAnswerValues(prompt, selected, {})).toEqual([["Yes"]]);
    expect(buildQuestionAnswerValues(prompt, {}, "Typed answer")).toEqual([["Typed answer"]]);
    expect(buildQuestionResponse(prompt, selected, {})).toBe("Choose: Yes");
  });
  it("sends one answer for a single-choice question when the person typed their own", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "greeting",
          question: "Which greeting should I use?",
          options: [{ label: "Hello" }, { label: "Hi" }],
          allowCustomAnswer: true,
        },
      ],
    };

    // A single-choice question may only answer with one value, never an option plus free text.
    expect(buildQuestionAnswerValues(prompt, { greeting: ["Hello"] }, { greeting: "Good day" })).toEqual([
      ["Good day"],
    ]);
    expect(buildQuestionResponse(prompt, { greeting: ["Hello"] }, { greeting: "Good day" })).toBe(
      "Which greeting should I use?: Good day",
    );
  });

  it("keeps the typed answer beside the checked options on a multiple-choice question", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "sizes",
          question: "Which sizes do you want?",
          options: [{ label: "Small" }, { label: "Large" }],
          multiple: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(buildQuestionAnswerValues(prompt, { sizes: ["Small"] }, { sizes: "Extra large" })).toEqual([
      ["Small", "Extra large"],
    ]);
  });

  it("treats a chosen but empty Other as no answer", () => {
    const prompt: ChatInputQuestionPrompt = {
      questions: [
        {
          id: "greeting",
          question: "Which greeting should I use?",
          options: [{ label: "Hello" }],
          required: true,
          allowCustomAnswer: true,
        },
      ],
    };

    expect(hasMissingRequiredQuestionAnswer(prompt, {}, { greeting: "" })).toBe(true);
    expect(buildQuestionAnswerValues(prompt, {}, { greeting: "" })).toEqual([[]]);
  });

  it("ticks a step whenever the question would send something", () => {
    const multiple = {
      id: "sizes",
      question: "Which sizes do you want?",
      options: [{ label: "Small" }],
      multiple: true,
      allowCustomAnswer: true,
    };
    const single = { id: "greeting", question: "Which greeting?", options: [{ label: "Hello" }] };
    const prompt: ChatInputQuestionPrompt = { questions: [multiple, single] };

    // Checking a box and then opening an empty Other still sends the box, so the step is answered.
    expect(hasMissingRequiredQuestionAnswer(prompt, { sizes: ["Small"] }, { sizes: "" })).toBe(false);
    expect(buildQuestionAnswerValues(prompt, { sizes: ["Small"] }, { sizes: "" })[0]).toEqual(["Small"]);
  });

  it("tracks Other as a choice rather than a field that is always open", () => {
    const question = { id: "greeting", question: "Which greeting should I use?", options: [{ label: "Hello" }] };
    const key = getQuestionSelectionKey(question, 0);

    expect(isQuestionOtherSelected({}, question, 0)).toBe(false);

    const chosen = toggleQuestionOtherAnswer({}, question, 0);
    expect(isQuestionOtherSelected(chosen, question, 0)).toBe(true);
    expect(chosen[key]).toBe("");

    expect(isQuestionOtherSelected(toggleQuestionOtherAnswer(chosen, question, 0), question, 0)).toBe(false);
    expect(isQuestionOtherSelected(clearQuestionOtherAnswer({ [key]: "Good day" }, question, 0), question, 0)).toBe(
      false,
    );
  });

  it("skips with no entries at all, which an answered form never produces", () => {
    expect(buildSkippedQuestionResponse()).toEqual({ answers: [] });
  });
});
