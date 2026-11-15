import { expect, test } from "bun:test";
import { evaluateStorageExpression } from "@pstdio/sdk/data";
import type { JsonObject } from "@pstdio/sdk/extensions";
import {
  validOutcomeHeaderExpression,
  validResponseExpression,
  validStoredRequestExpression,
} from "./review-query-expressions";
import { parseStoredOutcome, parseStoredRequest } from "./review-request-validation";

const actor = { type: "human", id: "person", displayName: "Person" };
const request: JsonObject = {
  id: "request",
  ticketId: "ticket",
  title: "Review",
  instructions: "Choose",
  requestedAt: "now",
  requestedBy: actor,
  context: {
    reason: "a custom reason",
    workspaceId: null,
    sessionId: null,
    relatedSessionId: null,
    attemptRevision: -2,
  },
  request: {
    kind: "decision",
    questions: [
      {
        id: "réponse\u0000",
        label: "Answer",
        required: true,
        input: { kind: "multiple-choice", options: [{ id: "été", label: "Summer" }] },
      },
      { id: "optional", label: "Optional", required: false, input: { kind: "text" } },
    ],
  },
};
const accepted = (run: () => unknown) => {
  try {
    run();
    return true;
  } catch {
    return false;
  }
};

test("indexed request validity preserves the actual stored parser's accepted shapes", () => {
  const values: (JsonObject | null)[] = [
    request,
    null,
    {},
    { ...request, title: "\u2003\ufeff" },
    { ...request, context: { ...(request.context as JsonObject), attemptRevision: 1.5 } },
    { ...request, request: { kind: "task" } },
    { ...request, request: { kind: "decision", questions: [] } },
    { ...request, requestedBy: { ...actor, type: "unknown" } },
  ];
  for (const value of values) {
    expect(evaluateStorageExpression(validStoredRequestExpression, undefined, { value })).toBe(
      accepted(() => parseStoredRequest(value)),
    );
  }
});

test("indexed outcomes preserve optional empty answers, exact choices, and malformed-response attention", () => {
  const parsed = parseStoredRequest(request);
  const responses: Record<string, string | string[]>[] = [
    { "réponse\u0000": ["été"] },
    { "réponse\u0000": ["été"], optional: [] },
    { "réponse\u0000": ["été"], optional: "\u2003" },
    { "réponse\u0000": ["été", "été"] },
    { "réponse\u0000": ["winter"] },
    { "réponse\u0000": "été" },
    {},
    { "réponse\u0000": ["été"], unexpected: "value" },
  ];
  for (const answers of responses) {
    const value = { kind: "answered", at: "now", by: actor, response: { answers } };
    const header = evaluateStorageExpression(validOutcomeHeaderExpression, undefined, { value });
    const response = evaluateStorageExpression(validResponseExpression, (_name, up) =>
      up ? request.request : value.response,
    );
    expect(header === true && response === true).toBe(accepted(() => parseStoredOutcome(parsed, value)));
  }
});
