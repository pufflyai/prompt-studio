import { describe, expect, it } from "bun:test";
import type { SessionMessage, ToolPart } from "../components/message-types";
import { hasQuestionResponse, resolveActiveQuestionPrompt } from "./question-prompt";

const questionPart = (state: ToolPart["state"]): SessionMessage => ({
  id: "m1",
  role: "assistant",
  parts: [{ type: "tool", tool: "question", callId: "c1", status: "completed", state }],
});

const input = { questions: [{ id: "language", question: "Which language?", options: [{ label: "TypeScript" }] }] };

describe("a skipped question", () => {
  it("counts as responded even though it carries no answers", () => {
    expect(hasQuestionResponse({ answers: [] })).toBe(true);
    expect(hasQuestionResponse({ answers: [["TypeScript"]] })).toBe(true);
    expect(hasQuestionResponse(undefined)).toBe(false);
    expect(hasQuestionResponse({})).toBe(false);
  });

  it("does not reopen the form after the conversation reloads", () => {
    // Reading the response text alone returns nothing for a skip, which used to look identical to
    // a question nobody had touched and brought the same form back.
    expect(resolveActiveQuestionPrompt([questionPart({ input, metadata: { answers: [] } })])).toBeUndefined();
  });

  it("still opens the form while nothing has answered it", () => {
    expect(resolveActiveQuestionPrompt([questionPart({ input })])?.questions).toHaveLength(1);
  });
});
