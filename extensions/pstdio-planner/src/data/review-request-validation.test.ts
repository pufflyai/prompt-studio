import { expect, test } from "bun:test";
import { parseRequestBody } from "./review-request-validation";

const text = (id: string) => ({ id, label: id, required: true, input: { kind: "text" } });

test("decision requests need unique questions and unique choices", () => {
  expect(() => parseRequestBody({ kind: "decision", questions: [] })).toThrow("Questions must be present");
  expect(() => parseRequestBody({ kind: "decision", questions: [text("a"), text("a")] })).toThrow("unique");
  expect(() =>
    parseRequestBody({
      kind: "decision",
      questions: [{ id: "a", label: "A", required: true, input: { kind: "single-choice", options: [] } }],
    }),
  ).toThrow("Choices must be present");
  expect(() => parseRequestBody({ kind: "decision", questions: [{ ...text("a"), input: { kind: "date" } }] })).toThrow(
    "invalid input kind",
  );
  expect(() => parseRequestBody({ kind: "approval" })).toThrow('Request kind must be "task" or "decision"');
});

test("valid requests keep only the request shape", () => {
  expect(parseRequestBody({ kind: "task", extra: true })).toEqual({ kind: "task" });
  expect(
    parseRequestBody({
      kind: "decision",
      questions: [
        {
          id: "a",
          label: "A",
          required: false,
          input: { kind: "multiple-choice", options: [{ id: "x", label: "X" }] },
        },
      ],
    }),
  ).toEqual({
    kind: "decision",
    questions: [
      { id: "a", label: "A", required: false, input: { kind: "multiple-choice", options: [{ id: "x", label: "X" }] } },
    ],
  });
});
